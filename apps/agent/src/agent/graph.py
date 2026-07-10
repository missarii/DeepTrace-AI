"""LangGraph autonomous research workflow - explicit nodes, typed state, bounded loops."""
from __future__ import annotations
import asyncio
import time
import uuid
from typing import AsyncIterator
from langgraph.graph import StateGraph, END
from .schemas import ResearchState, PlanSchema
from .config import settings
from .providers import search as search_mod
from .providers import chat as chat_mod
from .retrieval.extract import extract_text, content_hash, chunk_text, deduplicate, rrf_fuse, domain_of
from .retrieval.citations import validate_citations
from .security.ssrf import canonicalize, safe_fetch
from .security.injection import contains_injection, wrap_untrusted

DEPTH_BUDGETS = {"quick": (1, 6), "standard": (2, 16), "comprehensive": (3, 24)}


async def validate_request(state: ResearchState) -> ResearchState:
    q = (state.get("question") or "").strip()
    if len(q) < 10:
        return {**state, "errors": [*state.get("errors", []), "question too short"]}
    return state


async def understand_objective(state: ResearchState) -> ResearchState:
    return {**state, "queries": []}


async def create_research_plan(state: ResearchState) -> ResearchState:
    res = await chat_mod.chat([
        {"role": "system", "content": "You are a research planner. Reply with PLAN JSON only."},
        {"role": "user", "content": "PLAN the research for: " + state["question"]},
    ])
    plan = None
    for _ in range(3):
        try:
            plan = PlanSchema.model_validate_json(res["text"]).model_dump()
            break
        except Exception:
            res = await chat_mod.chat([
                {"role": "system", "content": "Return valid PLAN JSON only."},
                {"role": "user", "content": "PLAN retry: " + state["question"]},
            ])
    if plan is None:
        plan = {"primary_question": state["question"], "subquestions": [state["question"]],
                "objectives": state.get("objectives", []), "source_types": ["web"],
                "queries": [state["question"]], "completion_criteria": ["collect sources"]}
    return {**state, "plan": plan, "queries": plan["queries"]}


async def decompose_questions(state: ResearchState) -> ResearchState:
    plan = state.get("plan", {})
    subs = plan.get("subquestions", [state["question"]])
    extra = [s + " datasets evaluation limitations" for s in subs[:3]]
    return {**state, "queries": list(dict.fromkeys([*plan.get("queries", []), *extra]))[:20]}


async def select_search_strategy(state: ResearchState) -> ResearchState:
    return state


async def execute_searches(state: ResearchState) -> ResearchState:
    budget = int(state.get("config", {}).get("searchBudget", 16))
    queries = state.get("queries", [])[:budget]
    done = state.get("searches_done", 0)
    results: list = []
    for q in queries:
        if done >= budget:
            break
        try:
            rs = await search_mod.search(q, 6)
            results.extend([{"provider": r.provider, "query": r.query, "rank": r.rank, "url": r.url, "title": r.title, "snippet": r.snippet} for r in rs])
        except Exception as e:
            results.append({"_error": str(e)[:200], "query": q})
        done += 1
    return {**state, "searches_done": done, "sources": [*state.get("sources", []), *results]}


async def fetch_and_extract_sources(state: ResearchState) -> ResearchState:
    docs: list = []
    seen: set = set()
    for e in state.get("sources", [])[:60]:
        if e.get("_error") or not e.get("url"):
            continue
        try:
            canon = canonicalize(e["url"])
        except Exception:
            continue
        if canon in seen:
            continue
        try:
            final, html, meta = await safe_fetch(e["url"])
            text, em = extract_text(html, final)
            if contains_injection(text[:4000]):
                meta["injection_flag"] = True
            docs.append({"id": uuid.uuid4().hex, "url": canon, "title": e.get("title") or em.get("title") or canon,
                         "domain": domain_of(canon), "text": text[:20000], "hash": content_hash(text),
                         "query": e.get("query"), "rank": e.get("rank"), "provider": e.get("provider")})
            seen.add(canon)
        except Exception:
            continue
    docs = deduplicate(docs, key="hash")
    return {**state, "sources": docs}


async def rank_evidence(state: ResearchState) -> ResearchState:
    docs = state.get("sources", [])
    order = sorted(range(len(docs)), key=lambda i: len(docs[i].get("text", "") or ""), reverse=True)
    ids = [docs[i]["id"] for i in order]
    scores = dict(rrf_fuse([ids, list(reversed(ids))])) if ids else {}
    for d in docs:
        d["relevance"] = round(float(scores.get(d["id"], 0)) * 10, 3)
    docs.sort(key=lambda d: d.get("relevance", 0), reverse=True)
    return {**state, "sources": docs}


async def extract_claims(state: ResearchState) -> ResearchState:
    claims: list = []
    evidences: list = []
    for d in state.get("sources", [])[:30]:
        for ch in chunk_text(d.get("text", ""))[:4]:
            passage = ch["text"][:600]
            if len(passage) < 80:
                continue
            eid = uuid.uuid4().hex
            evidences.append({"id": eid, "source_id": d["id"], "passage": passage, "chunk_ref": "chunk-%d" % ch["ordinal"],
                              "start": ch["start"], "end": ch["end"], "relevance": d.get("relevance", 0), "relation": "unverified"})
            claims.append({"id": uuid.uuid4().hex, "text": passage[:220], "category": "fact", "status": "unverified", "evidence_id": eid})
    return {**state, "evidences": evidences, "claims": claims}


async def verify_claims(state: ResearchState) -> ResearchState:
    for c in state.get("claims", []):
        ev = next((x for x in state.get("evidences", []) if x["id"] == c.get("evidence_id")), None)
        if not ev:
            c["status"] = "insufficient"
            continue
        overlap = len(set(c["text"].lower().split()) & set(ev["passage"].lower().split()))
        low = ev["passage"].lower()
        if ("not " in low) or ("however" in low):
            c["status"] = "mixed"
        elif overlap >= 5:
            c["status"] = "supports"
        else:
            c["status"] = "insufficient"
        ev["relation"] = c["status"] if c["status"] in ("supports", "contradicts", "mixed") else "unverified"
    return state


async def assess_coverage(state: ResearchState) -> ResearchState:
    supported = sum(1 for c in state.get("claims", []) if c.get("status") == "supports")
    cov: dict = {"sources": len(state.get("sources", [])), "supported_claims": supported,
           "total_claims": len(state.get("claims", [])), "iteration": state.get("iteration", 0), "gaps": []}
    if supported < 3:
        cov["gaps"].append("Too few supported claims.")
    if cov["sources"] < 5:
        cov["gaps"].append("Low source diversity.")
    return {**state, "coverage": cov}


async def synthesize_report(state: ResearchState) -> ResearchState:
    claims = [c for c in state.get("claims", []) if c.get("status") in ("supports", "mixed")]
    if not claims:
        return {**state, "report": {"title": state["question"][:120],
                "summary": "Insufficient evidence retrieved; no verified claims met the support threshold.",
                "methodology": "Bounded retrieval with SSRF-safe extraction; gaps recorded.",
                "findings": [], "contradictions": [], "gaps": state.get("coverage", {}).get("gaps", ["insufficient evidence"]),
                "limitations": ["Do not treat as conclusive."], "insufficient": True}}
    res = await chat_mod.chat([{"role": "system", "content": "Synthesize evidence. Only use provided passages."},
        {"role": "user", "content": "Synthesize: " + " | ".join(wrap_untrusted(c["text"], "evidence") for c in claims[:12])}])
    findings = [{"heading": "Finding %d" % (i + 1), "body": c["text"], "citation": c.get("evidence_id")} for i, c in enumerate(claims[:8])]
    return {**state, "report": {"title": state["question"][:120], "summary": res["text"][:800],
            "methodology": "Retrieved %d sources; %d supported/mixed claims." % (len(state.get("sources", [])), len(claims)),
            "findings": findings, "contradictions": [c["text"] for c in state.get("claims", []) if c.get("status") == "mixed"][:5],
            "gaps": state.get("coverage", {}).get("gaps", []),
            "limitations": ["Citation validation checks provenance, not truth."], "insufficient": False}}


async def validate_citations_node(state: ResearchState) -> ResearchState:
    evs = {e["id"]: e for e in state.get("evidences", [])}
    srcs = {s["id"]: s for s in state.get("sources", [])}
    citations: list = []
    for f in (state.get("report", {}).get("findings", []) or []):
        ev = evs.get(f.get("citation", ""))
        src = srcs.get(ev["source_id"]) if ev else None
        if ev and src:
            citations.append({"source_id": src["id"], "evidence_id": ev["id"], "passage": ev["passage"], "url": src["url"]})
    check = validate_citations(citations, state.get("sources", []), state.get("evidences", []))
    return {**state, "report": {**state.get("report", {}), "citations": check["valid"],
                                "flagged": check["flagged"], "citation_precision": check["citation_precision"]}}


def build_graph():
    g = StateGraph(ResearchState)
    nodes = [("validate_request", validate_request), ("understand_objective", understand_objective),
             ("create_research_plan", create_research_plan), ("decompose_questions", decompose_questions),
             ("select_search_strategy", select_search_strategy), ("execute_searches", execute_searches),
             ("fetch_and_extract", fetch_and_extract_sources), ("rank", rank_evidence),
             ("extract_claims", extract_claims), ("verify_claims", verify_claims),
             ("assess_coverage", assess_coverage), ("synthesize", synthesize_report),
             ("validate_citations", validate_citations_node)]
    for name, fn in nodes:
        g.add_node(name, fn)
    g.set_entry_point("validate_request")
    order = ["validate_request", "understand_objective", "create_research_plan", "decompose_questions",
             "select_search_strategy", "execute_searches", "fetch_and_extract", "rank",
             "extract_claims", "verify_claims", "assess_coverage", "synthesize", "validate_citations"]
    for a, b in zip(order, order[1:]):
        g.add_edge(a, b)
    g.add_edge("validate_citations", END)
    return g.compile()


async def run_research_stream(run_id, question, depth, objectives, config) -> AsyncIterator[dict]:
    state: ResearchState = {"run_id": run_id, "question": question, "depth": depth or "standard", "objectives": objectives or [],
             "config": config or {}, "queries": [], "searches_done": 0, "iteration": 0, "sources": [],
             "evidences": [], "claims": [], "coverage": {}, "errors": [], "started_at": time.time()}
    yield {"type": "research.started", "payload": {"runId": run_id}}
    for name, fn in [("validate_request", validate_request), ("understand_objective", understand_objective),
                     ("create_research_plan", create_research_plan), ("decompose_questions", decompose_questions),
                     ("select_search_strategy", select_search_strategy)]:
        state = await fn(state)
        if name == "create_research_plan":
            yield {"type": "plan.created", "payload": {"plan": state.get("plan")}}
    max_iter = int((config or {}).get("maxIterations", 2))
    it = 0
    while True:
        state = await execute_searches(state)
        yield {"type": "search.completed", "payload": {"searchesDone": state.get("searches_done"), "sources": len(state.get("sources", []))}}
        for _name, fn in [("fetch_and_extract", fetch_and_extract_sources), ("rank", rank_evidence),
                         ("extract_claims", extract_claims), ("verify_claims", verify_claims), ("assess_coverage", assess_coverage)]:
            state = await fn(state)
        yield {"type": "coverage.updated", "payload": state.get("coverage", {})}
        it += 1
        state["iteration"] = it
        gaps = state.get("coverage", {}).get("gaps", [])
        budget_left = state.get("searches_done", 0) < int((config or {}).get("searchBudget", 16))
        if not (gaps and it < max_iter and budget_left):
            break
        state["queries"] = ["%s additional evidence %d" % (question, i) for i in range(3)]
    yield {"type": "synthesis.started", "payload": {}}
    state = await synthesize_report(state)
    state = await validate_citations_node(state)
    try:
        from .persist import persist_results
        await persist_results(state)
    except Exception as e:
        yield {"type": "research.failed", "payload": {"error": str(e)[:300]}}
        return
    yield {"type": "report.completed", "payload": {"citations": len(state.get("report", {}).get("citations", []))}}

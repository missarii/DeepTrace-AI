"""Typed workflow state + Pydantic schemas for plan, claims, report."""
from __future__ import annotations
from typing import Literal, TypedDict
from pydantic import BaseModel, Field

Depth = Literal['quick', 'standard', 'comprehensive']
Relation = Literal['supports', 'contradicts', 'mixed', 'insufficient', 'unverified']

class PlanSchema(BaseModel):
    primary_question: str
    subquestions: list[str] = Field(min_length=1, max_length=10)
    objectives: list[str] = []
    source_types: list[str] = []
    queries: list[str] = Field(min_length=1, max_length=20)
    completion_criteria: list[str] = []

class ClaimSchema(BaseModel):
    text: str
    category: Literal['fact', 'interpretation', 'hypothesis', 'recommendation'] = 'fact'
    passage: str = ''
    source_url: str = ''
    relation: Relation = 'unverified'

class SearchResult(BaseModel):
    provider: str
    query: str
    rank: int
    url: str
    title: str = ''
    snippet: str = ''

class ResearchState(TypedDict, total=False):
    run_id: str
    question: str
    depth: str
    objectives: list[str]
    config: dict
    plan: dict
    queries: list[str]
    searches_done: int
    iteration: int
    sources: list[dict]
    evidences: list[dict]
    claims: list[dict]
    coverage: dict
    report: dict
    errors: list[str]
    started_at: float

# backend/schemas.py
from typing import List
from pydantic import BaseModel


class NailInstance(BaseModel):
    id: int
    score: float
    polygon: List[float]


class NailResponse(BaseModel):
    width: int
    height: int
    nails: List[NailInstance]

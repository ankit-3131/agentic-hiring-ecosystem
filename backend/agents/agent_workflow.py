from typing import TypedDict, Annotated, Dict, Any, List, Tuple
import operator
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage
import os, json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / '.env')

_api_key = os.environ.get("VITE_GEMINI_API_KEY", "")

_llm = None


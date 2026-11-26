import asyncio
import sqlite3
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal
from sqlglot.errors import SqlglotError
from .config import SCENARIO, CORS_ORIGINS
from . import config
from .database import seed_database
from .maas import check_connection, MaaSError, configuration_error
from .service import chat

status = {'state':'checking','message':'Checking the MaaS connection…'}

def resolve_model(model):
    if model is None:
        return config.MODEL
    if model not in config.MODELS:
        raise HTTPException(422, {'code':'invalid_model','message':'Unknown model. Choose one from the model list in /api/health.'})
    return model

@asynccontextmanager
async def lifespan(app):
    global status
    seed_database()
    error = configuration_error()
    if error:
        status = {'state':error[0], 'message':error[1]}
        task = None
    else:
        async def probe():
            global status
            result = await check_connection()
            result['model'] = config.MODEL
            status = result
        task = asyncio.create_task(probe())
    yield
    if task and not task.done():
        task.cancel()

app = FastAPI(title='ChatBI Retail Demo', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=['GET','POST'], allow_headers=['Content-Type'])

class Message(BaseModel):
    role: Literal['user','assistant']
    content: str = Field(max_length=3000)

class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[Message] = Field(default_factory=list, max_length=12)
    language: Literal['en', 'zh'] = 'en'
    model: str | None = Field(default=None, max_length=100)

class ConnectionCheckRequest(BaseModel):
    model: str | None = Field(default=None, max_length=100)

@app.get('/api/health')
def health():
    return {'status':'ok', 'maas':status, 'model':config.MODEL, 'models':config.MODELS, 'default_model':config.MODEL, 'database':'sqlite', 'features':{'charts':True}}

@app.post('/api/connection/check')
async def connection_check(request: ConnectionCheckRequest | None = None):
    global status
    model = resolve_model(request.model if request else None)
    result = await check_connection(model)
    result['model'] = model
    status = result
    return result

@app.get('/api/scenario')
def scenario():
    return {k:SCENARIO[k] for k in ['id','name','subtitle','description','currency','date_range','suggestions','metrics']}

@app.post('/api/chat')
async def chat_endpoint(request: ChatRequest):
    if not request.question.strip():
        raise HTTPException(422, 'Question cannot be empty.')
    try:
        return await chat(request.question, [m.model_dump() for m in request.history], request.language, resolve_model(request.model))
    except MaaSError as error:
        raise HTTPException(503, {'code':error.code,'message':error.message}) from None
    except (ValueError, sqlite3.Error, SqlglotError):
        raise HTTPException(422, {'code':'invalid_query','message':'Unable to run this query safely. Specify the dates, metrics and dimensions, then try again.'}) from None

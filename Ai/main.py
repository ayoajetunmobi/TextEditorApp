from fastapi import FastAPI, UploadFile, File, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import socketio
from aiLogic import ( Agent_Gen, Agent_Query, Build_Keywords, Build_Chat_Graph, 
                      Agent_Gen_Excel_Prompt, Build_Improve_Text, Build_Graph)
from markitdown import MarkItDown
import os
import io
import tempfile
from fastapi.responses import FileResponse
import pandas as pd
from typing import Any


os.environ["JAVA_HOME"] = r"C:\Program Files\Java\jdk-26.0.1"
# the library to convert from .md to .xlxs and more

import jpype
# import asposecells
jpype.startJVM(
       jpype.getDefaultJVMPath(),
    "--enable-native-access=ALL-UNNAMED"
)
from asposecells.api import Workbook, LoadOptions, LoadFormat, SaveFormat
import aspose.words as aw
import json
from langgraph.checkpoint.redis.aio import AsyncRedisSaver
from contextlib import asynccontextmanager


import os
import json
from sqlalchemy import update, bindparam, MetaData, Table, create_engine, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Session
from dotenv import load_dotenv
load_dotenv()
import sys



app = FastAPI()
rest_app = APIRouter()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost:4000",
    "https://127.0.0.1:4000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods="*",
    allow_headers="*",
)

# NEW: Standard POST endpoint for Document Generation
@rest_app.post("/gen_ai_doc")
async def generate_ai_document(data: dict):
    data_send = {
        "messages": [{"content": data["query"]}],
        "type": data["type"]
    }
    generated_doc = await Build_Graph(data["chatid"], data_send)
    print(generated_doc)
    return {"aidoc": generated_doc[-1]['text']}


@rest_app.post("/get_table_query")
async def table_content(data:dict):
    print("content",data["data"][0]["content"])
    return_res = await Agent_Gen(data["data"]) 
    return return_res

@rest_app.post("/explain_query")
async def explain_content(data:dict):
    return_res = await Agent_Query(data["data"])
    return return_res

@rest_app.post("/keywords_detection")
async def detect_keywords(data:dict):
    return_res = await Build_Keywords(data["data"])
    return return_res
    

@rest_app.post("/get_chat_mesg")
async def get_chat_mesgs(data:dict):
    return_res = await Build_Chat_Graph(data["data"])
    return return_res

@rest_app.post("/improve_text")
async def AI_improve_text(data:dict):
    return_res = await Build_Improve_Text(data["data"])
    return return_res

@rest_app.post("/convert_pdf_markup")  
async def get_markup_text(file: UploadFile = File(...)):
    md = MarkItDown()
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
    try:
        # Convert the file using MarkItDown
        result = md.convert(temp_path)
        return {"markdown": result.markdown}
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@rest_app.post("/convert_to_down_doc")  
async def download_doc(data:dict):
    # 1. Define LoadOptions for Markdown
    load_options = LoadOptions(LoadFormat.MARKDOWN)
    load_options_docs = aw.loading.MarkdownLoadOptions()
    
    try:
        # Create a temporary file  
        if data["data"]["type"] == "html":
            with tempfile.NamedTemporaryFile(mode='w+t', encoding='utf-8', delete=False, suffix=".html") as temp_file:
                temp_file.write(data["data"]["doc"])
                temp_file_path = temp_file.name # Get the path for usage
                print(f"Temporary file created at: {temp_file_path}")
        else:
            with tempfile.NamedTemporaryFile(mode='w+t', encoding='utf-8', delete=False, suffix=".md") as temp_file:
                temp_file.write(data["data"]["doc"])
                temp_file_path = temp_file.name # Get the path for usage
                print(f"Temporary file created at: {temp_file_path}")
    
        # create output file
        if data["data"]["type"] == "excel":
            with tempfile.NamedTemporaryFile(mode='w+t', delete=False, suffix=".xlsx") as temp_file_output:
                temp_file_output_path = temp_file_output.name # Get the path for usage
                print(f"Temporary file created at: {temp_file_output_path}")
        elif data["data"]["type"] == "pdf" or data["data"]["type"] == "html":
            with tempfile.NamedTemporaryFile(mode='w+t', delete=False, suffix=".pdf") as temp_file_output:
                temp_file_output_path = temp_file_output.name # Get the path for usage
                print(f"Temporary file created at: {temp_file_output_path}")
        else:
            with tempfile.NamedTemporaryFile(mode='w+t', delete=False, suffix=".docx") as temp_file_output:
                temp_file_output_path = temp_file_output.name # Get the path for usage
                print(f"Temporary file created at: {temp_file_output_path}")

        
        if data["data"]["type"] == "excel":
            # Load the Markdown file
            workbook = Workbook(temp_file_path,load_options)
            # Save as XLSX
            workbook.save(temp_file_output_path,SaveFormat.XLSX)
        elif data["data"]["type"] == "pdf":
            doc = aw.Document(temp_file_path, load_options_docs)
            # Save as pdf
            doc.save(temp_file_output_path,aw.SaveFormat.PDF)
        elif data["data"]["type"] == "html":
            doc = aw.Document(temp_file_path,aw.loading.HtmlLoadOptions())
            doc.save(temp_file_output_path,aw.SaveFormat.PDF)
        else:
            doc = aw.Document(temp_file_path, load_options_docs)
            # Save as docx
            doc.save(temp_file_output_path,aw.SaveFormat.DOCX)


        print("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++",temp_file_output_path)
        return FileResponse(
            path=temp_file_output_path, 
            filename="custom_name.xlsx", 
            media_type='application/xlsx'
        )
    except Exception as e:
        print(e) 
    finally:
        print("sent")
    #    if os.path.exists(temp_file_path) and os.path.exists(temp_file_output_path):
    #      os.remove(temp_file_path)
    #      os.remove(temp_file_output_path)


@rest_app.post("/excel_chat")  
async def improve_text(data:dict):
    # Separate headers and data
    headers = data["data"][0]
    raw_rows = data["data"][1:]

    # Normalize every row to match the exact length of the headers
    num_cols = len(headers)
    data_rows = []
    for row in raw_rows:
        row_list = list(row)
        if len(row_list) < num_cols:
            # Pad shorter rows with empty strings
            row_list.extend([""] * (num_cols - len(row_list)))
        elif len(row_list) > num_cols:
            # Truncate longer rows to match header count
            row_list = row_list[:num_cols]
        data_rows.append(row_list)

    # Create the DataFrame safely
    df = pd.DataFrame(data_rows, columns=headers)

    # Get the CSV content as a string (omit the file path and index)
    csv_string = df.to_csv(index=False)
    data["data"]=csv_string

    result = await Agent_Gen_Excel_Prompt(data)
    try:
        # Read using pandas (skip_blank_lines=True handles the extra line spacing)
        formatted_result = json.loads(result[len(result)-1]["text"])
        if formatted_result["explain_decision"] == "dashboard":
            return formatted_result
        
        df_ = pd.read_csv(io.StringIO(formatted_result["formatted_data"]), skip_blank_lines=True)

        # Replace NaN / infinite values with empty strings so FastAPI can serialize to JSON
        df_ = df_.replace([float("inf"), float("-inf")], "").fillna("")

        # Convert to your nested array with headers at index 0
        nested_array = df_.to_numpy().tolist()
        nested_array.insert(0, df_.columns.tolist())

        new_obj_result = {
            "explain_decision": formatted_result["explain_decision"],
            "formatted_data": nested_array
        }

        print(new_obj_result)
        return new_obj_result
    except Exception as e:
        print(e)
        formatted_result = result[len(result) - 1]["text"]
        return {"explain_decision":formatted_result, "formatted_data":[]}
    
app.mount("/rest", rest_app)

# if __name__ == "__main__":
#     asyncio.run(employee_graph())

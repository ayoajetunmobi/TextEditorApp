import os
import json
import asyncio
from dotenv import load_dotenv
from dataclasses import dataclass
from typing import TypedDict, Literal, Annotated, List

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage, AnyMessage
from langchain_core.runnables.config import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command, interrupt
from langgraph.runtime import Runtime
from langgraph.graph import StateGraph, START, END, MessagesState, add_messages
from markitdown import MarkItDown

from typing import TypedDict, Literal, Annotated, List, Optional,Any,Dict,Union
from pydantic import BaseModel, Field

# Shared in-memory checkpointer so thread history persists across requests
memory_checkpointer = MemorySaver()


def ollamaModel(model: str):
    ollamModel = ChatOllama(
        model=model,
        temperature=0,
    )
    return ollamModel


load_dotenv()  # Loads variables from .env into os.environ
SECRET_KEY = os.getenv("GOOGLE_API_KEY")

gemma = ChatGoogleGenerativeAI(
    # model="gemma-4-31b-it",
    model="gemini-3.5-flash-lite",
    temperature=0.3,  # Gemini 3.0+ defaults to 1.0
    max_tokens=None,
    timeout=None,
    max_retries=3,
    google_api_key=SECRET_KEY
)

Models = [
    "qwen3.5:397b-cloud", "qwen3.5:cloud", "qwen2.5-coder:latest",
    "qwen2.5-coder:1.5b", "qwen3.5:0.8b", "gemma-4-31b-it"
]

document_type = ["stories", "financial report", "code", "letters"]


class State_Doc_Gen(MessagesState):
    type: Literal[
        "qwen3.5:397b-cloud", "qwen3.5:cloud", "qwen2.5-coder:latest",
        "qwen2.5-coder:1.5b", "qwen3.5:0.8b", "gemma-4-31b-it"
    ]


class query_type_pred(TypedDict):
    expected_output_type: Literal["stories", "financial report", "code", "letters"]


@dataclass
class Context:
    user_id: str


def Get_Rag(input: State_Doc_Gen):
    """you are to generate a document as markup for the user."""
    # if input["type"] != "gemma-4-31b-it":
    #     model = ollamaModel(input["type"])
    # else:
    #     model = gemma

    model = gemma
    query_type = model.with_structured_output(query_type_pred)
    doc_type_ai = query_type.invoke(input["messages"][0].content)
    print(doc_type_ai)

    md = MarkItDown()

    if doc_type_ai["expected_output_type"] == "financial report":
        data = [
            md.convert("./staticfiles/pdfsummary2.pdf").markdown,
            md.convert("./staticfiles/pdfsummary1.pdf").markdown,
            md.convert("./staticfiles/Bill_Snow_Financial_Model_2004_03_09.xls").markdown,
            md.convert("./staticfiles/345b4_Employment_Separation_Agreement_Template.docx").markdown,
            md.convert("./staticfiles/e7ca9_Financial_Analysis_Report.docx").markdown
        ]
        Aimesg = "\n".join(data)
    elif doc_type_ai["expected_output_type"] == "letters":
        data = [
            md.convert("./staticfiles/Formal Complaint Letter.pdf").markdown,
            md.convert("./staticfiles/formal letter format.pdf").markdown,
            md.convert("./staticfiles/formal letter format.pdf").markdown,
        ]
        Aimesg = "\n".join(data)
    else:
        Aimesg = ""
    return {"messages": [AIMessage(content=Aimesg)], "type": input["type"]}


subgraph_builder = StateGraph(State_Doc_Gen)
subgraph_builder.add_node("rag_agent", Get_Rag)
subgraph_builder.add_edge(START, "rag_agent")
subgraph_builder.add_edge("rag_agent", END)
subgraph = subgraph_builder.compile()


def Document_Generator(input: State_Doc_Gen):
    """you are to generate a document as markup for the user."""
    if input["type"] in Models:
        get_rag_ = subgraph.invoke({
            "messages": [HumanMessage(content=input["messages"][0].content)],
            "type": input["type"]
        })

        # if input["type"] != "gemma-4-31b-it":
        #     model = ollamaModel(input["type"])
        # else:
        #     model = gemma

        model = gemma
        system_prompt = (
            f"you are to follow the example and instruction which is this {get_rag_['messages'][0].content}. "
            "After which you would create a document sample based on the user request"
        )
        messages_invoke = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=input["messages"][0].content)
        ]

        try:
            request = model.invoke(messages_invoke)
            return {"messages": [AIMessage(content=request.content)], "type": input["type"]}
        except Exception as e:
            print("error occured at", e)
    else:
        return ""


# Pre-compile document generation graph (no checkpointer needed for one-off generation)
doc_builder = StateGraph(State_Doc_Gen)
doc_builder.add_node("main_node", Document_Generator)
doc_builder.add_node("subgraph_node", subgraph)
doc_builder.add_edge(START, "main_node")
doc_graph = doc_builder.compile()


async def Build_Graph(id_: str, query: State_Doc_Gen):
    if len(id_) <= 3:
        return ""

    config = {"configurable": {"thread_id": id_}}
    result = await doc_graph.ainvoke(
        input={
            "messages": [HumanMessage(content=query["messages"][0]["content"])],
            "type": query["type"]
        },
        config=config,
    )
    
    # Return the final AIMessage content generated by Document_Generator
    return result["messages"][-1].content
           
class table_content(TypedDict):
    tablecontent: list[dict[str, str]]


@tool
async def GenTableCont(state: list[dict[str, str]]):
    """Generate Table Content From The Data Provided."""
    print("Getable", state)
    system_prompt = (
        "you are to analyse each page pased to you as a string named content and its page number named pageno "
        "and create a table of content like that found in a textbook, you are to create a table of content with "
        "short titles and the page no where we can find that title or content, the input has page as content and page number as pageno"
        "your output should not have json``` or ```json or ```"
    )
    model = gemma
    model_out_type = model.with_structured_output(table_content)
    messages_invoke = await model_out_type.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=state)
    ])
    return messages_invoke


@tool
async def Explain_context(state: str):
    """Describe the query given intuitively."""
    print("explain", state)
    system_prompt = "you are to explain the given query or text to the user as precisely and as brief as possible"
    model = gemma
    messages_invoke = await model.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=state)
    ])
    return messages_invoke.content


agent_one = create_agent(
    model=gemma,
    tools=[GenTableCont, Explain_context],
    system_prompt=(
        "You have two tools use the tool in which the input given suits better"
        "the first tool generates a table of content"
        "if string input contains a  dictionary with conten and pageno choose the tool GenTableCont"
        "if GenTableCont was selected return the exact output to it gave to the user or return a string that contains a list with dictionaries title and page number"
        "the second tool explains the query given intuitively"
        "ALWAYS delegate questions to the appropriate tool."
        "output should not include ``` or ```json"
    ),
    checkpointer=None,
)


async def Agent_Gen(query):
    if isinstance(query, list):
        data = json.dumps(query)
    else:
        data = query
    result = await agent_one.ainvoke(
        input={"messages": [
            {"role": "system", "content": "always, i repeat makesure you always return data as a list of objects representing the table of content, following this particular format [{'title':'name of book','pageno':'1'}], do not return output with ``` or ```json"},
            {"role": "user", "content": data}
        ]},
    )
    return result["messages"][-1].content


async def Agent_Query(query: str):
    result = await agent_one.ainvoke(
        input={"messages": [
            {"role": "system", "content": "explain the query briefly and intuitively"},
            {"role": "user", "content": query}
        ]},
    )
    print(result["messages"])
    return result["messages"][-1].content


class keyword_analysis(MessagesState):
    document: str


class key_word_points(TypedDict):
    content: str
    explanation: str


class output_key(TypedDict):
    output: List[key_word_points]


async def Get_AllKeyWords(keywords: keyword_analysis):
    """Describe the query given intuitively."""
    system_prompt = SystemMessage(
        f"""Given the article {keywords["document"]},
        your are to decide if a string in the list of strings sent to you is a keyword or key statement strictly based on the knowledge from the article data no extra domain knowledge should be used
        the criteria for chosing a keyword is based on how relevant it is to the context of the article if not ignore,
        return as many keyword that you found
        """
    )
    model = gemma
    output_model = model.with_structured_output(output_key)
    messages_invoke = await output_model.ainvoke([
        system_prompt,
        HumanMessage(content=keywords["messages"][0].content)
    ])
    print(messages_invoke)
    return {"messages": [AIMessage(content=json.dumps(messages_invoke))], "document": keywords["document"]}


builder_key = StateGraph(keyword_analysis)
builder_key.add_node("main_node", Get_AllKeyWords)
builder_key.add_edge(START, "main_node")
keyword_graph = builder_key.compile(checkpointer=None)


async def Build_Keywords(word: str):
    result = await keyword_graph.ainvoke(
        input={
            "messages": [
                SystemMessage(content="retrun the exact output from the node which is a list of dictionaries in the format [{'content':str,'explanation':str,'pageno':int,'points':dict('x':int,'y':int,'width':int,'height':int)}]"),
                HumanMessage(content=word[1])
            ],
            "document": word[0]
        }
    )
    return result["messages"][-1].content


class chat_user_doc(MessagesState):
    document: str
    history: str
    currMsg: str


async def Ai_Chat_Node(state: chat_user_doc):
    """Describe the query given intuitively."""
    system_prompt = (
        f"""Given this article {state["document"]} end of article,
            beginning of instructions,
            you are to answer users questions strictly based of the contextual meaning gathered from the article just given to you,
            if the users question does not relate to the article, tell the user you have no answer to thw quetion in  polite tone,
            always answer the user question irrespective of how many times it has been asked,
            this is your previous chat with this user,
            start of history
            {state["history"]}
            end of history,
            use this history to personalize your response
        """
    )

    model = gemma
    messages_invoke = await model.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=state["currMsg"])
    ])

    return {"messages": [AIMessage(content=json.dumps(messages_invoke.content))]}


# Pre-compile chat graph with the shared MemorySaver
chat_builder = StateGraph(chat_user_doc)
chat_builder.add_node("main_node", Ai_Chat_Node)
chat_builder.add_edge(START, "main_node")
chat_graph = chat_builder.compile(checkpointer=memory_checkpointer)


async def Build_Chat_Graph(data: str):
    config = {"configurable": {"thread_id": data[0]}}

    snapshot = await chat_graph.aget_state(config)
    all_messages = snapshot.values

    result = await chat_graph.ainvoke(
        input={
            "messages": [HumanMessage(content="")],
            "document": data[1],
            "history": all_messages,
            "currMsg": data[2]
        },
        config=config
    )
    data_be_passed = json.loads(result["messages"][-1].content)
    return {"messages": [AIMessage(content=data_be_passed[-1]["text"])]}


class ai_improve_text(MessagesState):
    query: str


async def Ai_Improve(state: ai_improve_text):
    """Improve the user query."""
    system_prompt = (
        """you are to improve the users input by correcting all tenses and gramatic errors and also making the sentence more professional,
        irrespective of what is given do your best to improve it.
        No need to tell the user what was done,
        return just the best improvement and nothing more.
        """
    )
    model = gemma
    messages_invoke = await model.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=state["query"])
    ])
    return {"messages": [AIMessage(content=json.dumps(messages_invoke.content))]}

improve_builder = StateGraph(ai_improve_text)
improve_builder.add_node("main_node", Ai_Improve)
improve_builder.add_edge(START, "main_node")
improve_graph = improve_builder.compile(checkpointer=None)


async def Build_Improve_Text(data: str):
    print(data)
    result = await improve_graph.ainvoke(
        input={
            "messages": [HumanMessage(content="")],
            "query": data
        },
    )
    data_be_passed = json.loads(result["messages"][-1].content)
    return {"messages": [AIMessage(content=data_be_passed[-1]["text"])]}

class excel_data_format(TypedDict):
    explain_decision:str
    formatted_data:Optional[str]

class ChartDataPoint(BaseModel):
    # This guarantees every single data object must still have a string identifier
    name: str
       # This forces the LLM to output key-value pairs here
    metrics: dict[str, float] = Field(
        description="Two or more extra metric fields with their numeric values (e.g., {'WidgetA': 150, 'WidgetB': 300})"
    )

class ChartConfig(BaseModel):
    type: Literal["Line Chart", "Pie Chart", "Bar Chart", "Scatter Plot", "Area Chart"]
    data: List[ChartDataPoint]

class DashboardPayload(BaseModel):
    charts: List[ChartConfig]
    instant_charts: List[Dict[str, Union[int, float]]] = Field(alias="instant charts")

class excel_dashboard(BaseModel):
    explain_decision: str
    formatted_data: DashboardPayload

    class Config:
        populate_by_name = True

class RuntimeConfig(BaseModel):
    data: str 

@tool
async def CreateAnalysis(state:str, config: RunnableConfig):
    """  Analyse the excel data and return the required data when neccesary.  """

    # Access your specific runtime variables
    configurable = config.get("configurable", {})
    csv_data = configurable.get("csv_data")
    
    system_prompt =f"""
    [SYSTEM INSTUCTIONS]
    Role & Objective
    You are an advanced, intelligent data analyst and Excel expert.
    Your goal is to process, clean, analyze, transform, 
    and forecast data provided as a CSV string format with every row starting after a new line
    (where the first row is the header).
    You will output results, cleansed data, or forecasts back into this exact csv file format 
    when required. Data Format Context The data will be passed to you as a CSV string format,
    where each new line represents a row.Example:"name,age,gender"
    Core CapabilitiesWhen requested, you must perform the following tasks:
    Data Cleaning & Preprocessing: Handle missing values, remove duplicates, 
    correct data types, and standardize formats (e.g., text, dates).
    Analysis & Insights: Calculate statistical summaries, identify trends, detect anomalies, 
    and provide actionable business insights.
    Data Transformation & Generation: Create custom Excel formulas, pivot data, merge datasets, 
    and generate new columns based on existing data.
    Machine Learning & Forecasting: Build predictive models, perform regression/classification tasks, 
    and generate future forecasts based on historical data patterns.
    Output GuidelinesArray Outputs: Whenever your task requires returning a modified or generated 
    dataset, you must output it as a valid nested JSON array matching the input structure, 
    with the first row being the headers.
    Analysis Outputs: If the user asks for insights, forecasts, or summaries, provide a clear, concise,
    and professional textual summary alongside the requested data.
    Custom Formulas: When generating new columns or formulas, clearly explain the logic 
    and the exact formula syntax used so the user can understand the transformation.
    Execution Constraints Do not include conversational filler when the user explicitly requests
    raw data output.Ensure all data alignments (matching columns to rows) are strictly maintained 
    during operations like sorting, filtering, or merging.

    [USER INPUT EXCEL DATA]
    {csv_data}

    [OUTPUT GENERATION INSTRUCTIONS]
    it is very important to Always return valid JSON with keys "explain_decision" and "formatted_data"
    "explain_decision" is a string while "formatted_data" is a csv string format where the first line is a
    header (Example:"name,age,gender") and the subsequent comma seperated lines are the row data matching
    those headers the user input always contains a JSON data with keys "prompt" and "data" the "prompt" key 
    contains the user desired task that you should perform the "data" key contains the excel data you will 
    perform the task on, it is in the structure of a csv string format the first line is the header is a csv 
    string format All task requested by the user should be performed strictly on the data provided, 
    without hallucination results from the model should always be accurate and based on the data provided by
    the user...
    """  

    model = gemma
    model_out_type = model.with_structured_output(excel_data_format)
    messages_invoke = await model_out_type.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=state)
    ])

    print("message returned",messages_invoke)
    return messages_invoke

@tool
async def Generate_Charts(state:str, config:RunnableConfig):
    """ Analyse and Generate Data that will be used to create a visual dashboards """
    print("visual charts choosen")
    # Access your specific runtime variables
    configurable = config.get("configurable", {})
    csv_data = configurable.get("csv_data")

    system_prompt = """ 
        [SYSTEM INSTUCTIONS]
        You are a backend data extraction assistant. Your sole job is to read raw data passed in as a csv string format 
        in the   [USER INPUT EXCEL DATA] section
        and format it into a structured chart JSON payload strictly based on the provided chart reference guide.
        Return ONLY raw JSON. Do not include markdown code blocks, conversational filler, or explanations.
        Analyze the user input data. Choose the correct chart types from the RAG Context. 
        Generate the single final JSON object.
        all charts type data you include must strictly follow the payload reference guide example given else it shouldn't be included
        The model should not hallucinate, results generated must be accurate and verifiable without errors and must be gotten from the data provided
        data produced by this model is useful for decision making so high accuracy is needed
        output generated for charts should follow the example payload data provided
        you must generate atleast five instant chart and five other charts

        [CHART RAG CONTEXT]
        # CHART SYSTEM DEFINITIONS AND DATA SPECIFICATIONS
        You must analyze incoming Excel data and map it to exactly one of the supported chart types below.
        Use the exact JSON structure provided in the examples.

        ## name=line Chart
        - Use case: Tracking changes, trends, or variables over continuous time (days, months, years).
        - Schema rules: 'labels' must be chronological string dates/times.
        - Example Payload:
            data=[
                {
                    name: 'column_header_name',
                    uv: 4000,
                    pv: 2400,
                    amt: 2400,
                },
                {
                    name: 'column_header_name2',
                    uv: 3000,
                    pv: 1398,
                    amt: 2210,
                },
            ];

        ## name=bar Chart
        - Use case: Comparing discrete categories, products, or regions.
        - Schema rules: 'labels' contains categories. 'datasets' contains numeric arrays matching the labels length.
        - Example Payload:

            data =[
                {
                    name: 'column_header_name',
                    uv: 4000,
                    pv: 2400,
                    amt: 2400,
                },
                {
                    name: 'column_header_name2',
                    uv: 3000,
                    pv: 1398,
                    amt: 2210,
                }
            ]

        ## name=Pie Chart
        - Use case: Showing percentages or part-to-whole relationships. Avoid if there are more than 6 categories.
        - Schema rules: Single dataset only. Values represent shares of a whole.
        - Example Payload:
          data=  [
                { name: 'Group A', value: 400 },
                { name: 'Group B', value: 300 },
                { name: 'Group C', value: 300 },
                { name: 'Group D', value: 200 }
            ];


        ## 4.name=Scatter Plot
        - Use case: Showing relationships, correlations, or distributions between two continuous numeric variables (X and Y axes).
        - Schema rules:  No global 'labels' array. 'datasets' contains an array of objects with explicit numeric 'x' and 'y' properties.
        - Example Payload:

         data01=   [
                { x: 100, y: 200, z: 200 },
                { x: 120, y: 100, z: 260 },
                { x: 170, y: 300, z: 400 },
                { x: 140, y: 250, z: 280 },
                { x: 150, y: 400, z: 500 },
                { x: 110, y: 280, z: 200 }
            ];

        data02=[
            { x: 200, y: 260, z: 240 },
            { x: 240, y: 290, z: 220 },
            { x: 190, y: 290, z: 250 },
            { x: 198, y: 250, z: 210 },
            { x: 180, y: 280, z: 260 },
            { x: 210, y: 220, z: 230 }
        ];

        ## name=Area Chart
        - Use case: Tracking total values over time while visually emphasizing the volume beneath the trend line.
        - Schema rules:  'labels' contains chronological dates/times. 'datasets' contains a single numeric array matching the labels length.
        - Example Payload:

        data=[
            {
                name: 'Page A',
                uv: 4000,
                pv: 2400,
                amt: 2400,
            },
            {
                name: 'Page B',
                uv: 3000,
                pv: 1398,
                amt: 2210,
            },
        ]

        ## Instant Charts specification
        - in this section you can generate any number of instant charts based on your analysis
        - this charts are usually sums, averages, aggregates, counts, etc
        [
        {"total revenue": number},
        {"average daily sales": number},
        {"total number of products": number}
        ] 
    """ + f"""
        [USER INPUT EXCEL DATA] 
        {csv_data}
    """ + """

        [OUTPUT SCHEMA]
       
        {
            "explain_decision": "dashboard", 
            "formatted_data": {
                "charts":[
                    {
                        "type": "Line Chart",
                        "data" : [
                            {
                                name: 'column_header_name',
                                uv: 4000,
                                pv: 2400,
                                amt: 2400,
                            },
                            {
                                name: 'column_header_name2',
                                uv: 3000,
                                pv: 1398,
                                amt: 2210,
                            }
                        ]
                    },
                    {
                        "type": "Pie Chart",
                        "data" : [
                            { name: 'Group A', value: 400 },
                            { name: 'Group B', value: 300 },
                            { name: 'Group C', value: 300 },
                            { name: 'Group D', value: 200 },
                        ]
                    },
                ],
                "instant charts":[
                    {"total revenue": 10000}, {"number of product": 20}
                ]
            }
        }
    """

    model = gemma  
    model_out_type = model.with_structured_output(excel_dashboard)
    messages_invoke = await model_out_type.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=state)
    ])

    return messages_invoke

agent_one=create_agent(
    model=gemma,
    tools=[CreateAnalysis, Generate_Charts],
    system_prompt=(  
        "You have two tools use the tool in which the input given suits better"
        "the first tool performs data cleaning and manipulations, analysis and forcasting and also machine learning on data"
        "the second tool creates a dashboard or chart, it returns data neccesary for this purpose"
        "ALWAYS delegate task to the appropriate tool."
    ),
    checkpointer=None,
)

async def Agent_Gen_Excel_Prompt(query):
    config = {
        "configurable": {
            "csv_data": query["data"],
        }
    }
    result = await agent_one.ainvoke(
        input = {"messages": [{"role":"system","content":""" 
                    Always return valid JSON unless the user specifically 
                    asks for a textual explanation or summary. Ensure all keys are enclosed in double quotes. 
                    The "explain_decision" value should be a brief string summarizing the formatted data. 
                    The "formatted_data" value must be a valid formatted csv string format, where the first inner 
                    line is the header (Example:"name,age,gender") and the subsequent comma seperated lines are the 
                    row data matching those headers. 
                    If you response is coming from the Generate_Charts tool, then "explain_decision" must always
                    return the word "dashboard" and "formatted_data" must always return a valid json.
                    Do not include markdown code blocks (like ```json) in any of your response; 
                    do not include markdown code block in "formatted_data" as it will be converted to another form
                    by program logic to be displayed in the frontend output the raw JSON text directly. 
                """},
            { "role": "user", "content":query["prompt"] } 
        ]},config=config)

        
    return result["messages"][-1].content



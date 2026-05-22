import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama
from langchain.agents import create_agent
from langchain.tools import tool
from dataclasses import dataclass
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command, interrupt
from langgraph.runtime import Runtime
from langchain_core.messages import SystemMessage,HumanMessage,AIMessage,BaseMessage, AnyMessage
from langgraph.graph import StateGraph, START, END, MessagesState,add_messages
from langgraph.checkpoint.redis.aio import AsyncRedisSaver  
import json

from markitdown import MarkItDown 
from typing import TypedDict, Literal, Annotated, List
from markitdown import MarkItDown
import asyncio


DB_URI = "redis://localhost:6379" 
def ollamaModel(model:str):
    ollamModel = ChatOllama(
        model=model,
        temperature=0,
    )
    return ollamModel

load_dotenv()  # Loads variables from .env into os.environ
SECRET_KEY = os.getenv("GOOGLE_API_KEY")

gemma = ChatGoogleGenerativeAI(
    model="gemma-4-31b-it",
    temperature=0.3,  # Gemini 3.0+ defaults to 1.0
    max_tokens=None,
    timeout=None,
    max_retries=3,
    google_api_key=SECRET_KEY
)

# llm = model.invoke("what can you do")
# print(llm.content)
# List of Models

Models = ["qwen3.5:397b-cloud","qwen3.5:cloud","qwen2.5-coder:latest",
                   "qwen2.5-coder:1.5b","qwen3.5:0.8b","gemma-4-31b-it"]

document_type = ["stories", "financial report", "code", "letters"]

# MessageState comes with built in chat format {user:role,content:query}
class State_Doc_Gen(MessagesState):
    type:  Literal["qwen3.5:397b-cloud","qwen3.5:cloud","qwen2.5-coder:latest",
                   "qwen2.5-coder:1.5b","qwen3.5:0.8b","gemma-4-31b-it"]


class query_type_pred(TypedDict):
    expected_output_type: Literal["stories", "financial report", "code", "letters"]

@dataclass
class Context:  # (1)!
    user_id: str


# get some samples to add to prompt
def Get_Rag(input: State_Doc_Gen):
    """ you are to generate a document as markup for the user. """

    if(input["type"] != "gemma-4-31b-it"):
        model = ollamaModel(input["type"])
    else:
        model = gemma

    query_type = model.with_structured_output(query_type_pred)

    doc_type_ai = query_type.invoke(input["messages"][0].content)
    print(doc_type_ai)

    md = MarkItDown()

    if(doc_type_ai["expected_output_type"] == "financial report"):
        data = [ 
                md.convert("./staticfiles/pdfsummary2.pdf").markdown,
                md.convert("./staticfiles/pdfsummary1.pdf").markdown,
                md.convert("./staticfiles/Bill_Snow_Financial_Model_2004_03_09.xls").markdown,
                md.convert("./staticfiles/345b4_Employment_Separation_Agreement_Template.docx").markdown,
                md.convert("./staticfiles/e7ca9_Financial_Analysis_Report.docx").markdown
            ]
        result = (s for s in data)
        Aimesg = "\n".join(result)
    elif(doc_type_ai["expected_output_type"] == "letters"):
        data = [
            md.convert("./staticfiles/Formal Complaint Letter.pdf").markdown,
            md.convert("./staticfiles/formal letter format.pdf").markdown,
            md.convert("./staticfiles/formal letter format.pdf").markdown,
        ]
        result = (s for s in data)
        Aimesg = "\n".join(result)
    else:  Aimesg = ""
    return {"messages": [AIMessage(content=Aimesg)],"type":input["type"]}


# {"messages":pdf_list}

# Subagents - no checkpointer setting (inherits parent) - no state for this, just a step in parent
# get_rag = create_agent(
#     model= gemma,
#     tools=[Get_Rag],
#     system_prompt="You are to analyse query and categorize it to fit a particular topic. and then rwturn the supporting documents"
# )

subgraph_builder = StateGraph(State_Doc_Gen)
subgraph_builder.add_node("rag_agent",Get_Rag)
subgraph_builder.add_edge(START, "rag_agent")
subgraph_builder.add_edge("rag_agent",END)
subgraph = subgraph_builder.compile()


# design the graph to generate document
# @tool
def Document_Generator(input: State_Doc_Gen):
    """  you are to generate a document as markup for the user. """

    if (input["type"] in Models):
        get_rag_ = subgraph.invoke({"messages": [HumanMessage(content=input["messages"][0].content)],"type":input["type"]})

        if(input["type"] != "gemma-4-31b-it"):
            model = ollamaModel(input["type"])
        else:
            model = gemma

        system_prompt = f"you are to follow the example and instruction which is this {get_rag_["messages"][0].content}. After which you would create a document sample based on the user request"       
        messages_invoke = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=input["messages"][0].content)
        ]

        try:
            request = model.invoke(
                messages_invoke
            )

            # print("content", request.content)
            return {"messages": [AIMessage(content=request.content)],"type":input["type"]}
        except Exception as e:
            print("error occured at", e)

    else:
        return ""
    
    
async def  Build_Graph(id_:str,query:State_Doc_Gen,socket):
    if len(id_) <=3:
        return None
    async with AsyncRedisSaver.from_conn_string(DB_URI) as checkpointer:
        builder = StateGraph(State_Doc_Gen)
        builder.add_node("main_node", Document_Generator)
        builder.add_node("subgraph_node", subgraph)

        # DEFINE START: Point START to your entry node
        builder.add_edge(START, "main_node")

        # builder.add_edge("main_node", END)
        checkpointer = MemorySaver()
        graph = builder.compile(checkpointer=checkpointer)
        config = {"configurable": {"thread_id":id_}}
                # graph.get_state(config)
        for chunk in graph.stream(
            input = {"messages": [HumanMessage(content=query["messages"][0]["content"])],"type":query["type"]},
            stream_mode="messages",
            version="v2",
            config=config,
        ):
            if chunk["type"] == "messages":
                msg, metadata = chunk["data"]
                # Filter the streamed tokens by the langgraph_node field in the metadata
                # to only include the tokens from the specified node
                await socket.emit("recvaidoc", {"data":msg.content}, room=id_)
                print(id_)
                print(msg.content, end="|", flush=True)

        history=list(graph.get_state_history(config))
        # print(snapshot.values.get("messages", []))

class table_content(TypedDict):
    tablecontent:list[dict[str,str]]

@tool
async def GenTableCont(state:list[dict[str,str]]):
    """Generate Table Content From The Data Provided."""
    print("Getable",state)
    system_prompt = f"you are to analyse each page pased to you as a string named content and its page number named pageno and create a table of content like that found in a textbook, you are to create a table of content with short titles and the page no where we can find that title or content, the input has page as content and page number as pageno"       
    model = gemma
    model_out_type = model.with_structured_output(table_content)
    messages_invoke = await model_out_type.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=state)
    ])

    return  messages_invoke

@tool
async def Explain_context(state:str):
    """Describe the query given intuitively."""
    print("explain",state)
    system_prompt = f"you are to explain the given query or text to the user as precisely and as brief as possible"       
    model = gemma  
    messages_invoke = await model.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=state)
    ])
    return messages_invoke.content


agent_one=create_agent(
    model=gemma,
    tools=[GenTableCont,Explain_context],
    system_prompt=(  
        "You have two tools use the tool in which the input given suits better"
        "the first tool generates a table of content"
        "if string input contains a  dictionary with conten and pageno choose the tool GenTableCont"
        "if GenTableCont was selected return the exact output to it gave to the user or return a string that contains a list with dictionaries title and page number"
        "the second tool explains the query given intuitively"
        "ALWAYS delegate questions to the appropriate tool."
    ),
    checkpointer=None,
)


async def Agent_Gen(query):
    if(str(type(query)) == "<class 'list'>"): 
        data = json.dumps(query)
    else:
        data = query
    result = await agent_one.ainvoke(
        input= {"messages": [{"role":"system","content":"always, i repeat makesure you always return data as a list of objects representing the table of content, following this particular format [{'title':'name of book','pageno':'1'}]"},{ "role": "user", "content": data }]},
    )
    return result["messages"][-1].content


async def Agent_Query(query:str): 
    result = await agent_one.ainvoke(
        input= {"messages": [{"role":"system","content":"explain the query briefly and intuitively"},{ "role": "user", "content": query }]},
    )
    print(result["messages"])
    return result["messages"][-1].content


class keyword_analysis(MessagesState):
    document:str


class key_word_points(TypedDict):
    content:str
    explanation:str

class output_key(TypedDict):
    output:List[key_word_points]

async def Get_AllKeyWords(keywords:keyword_analysis):
    """ Describe the query given intuitively. """
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
    return {"messages": [AIMessage(content=json.dumps(messages_invoke))],"document":keywords["document"]} 
 

builder_key = StateGraph(keyword_analysis)
builder_key.add_node("main_node", Get_AllKeyWords)
# DEFINE START: Point START to your entry node
builder_key.add_edge(START, "main_node")
# builder.add_edge("main_node", END)


async def Build_Keywords(word:str):
    checkpointer = None
    graph = builder_key.compile(checkpointer=checkpointer)
    result = await graph.ainvoke(
        input= {"messages": [
            SystemMessage(content="retrun the exact output from the node which is a list of dictionaries in the format [{'content':str,'explanation':str,'pageno':int,'points':dict('x':int,'y':int,'width':int,'height':int)}]"),
            HumanMessage(content=word[1])],"document":word[0]}
    )
    return result["messages"][-1].content


class chat_user_doc(MessagesState):
    document:str
    history:str
    currMsg:str

async def Ai_Chat_Node(state:chat_user_doc):
    """ Describe the query given intuitively. """
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

    # print(messages_invoke.content)
    return {"messages": [AIMessage(content=json.dumps(messages_invoke.content))]}


async def Build_Chat_Graph(data:str):
    async with AsyncRedisSaver.from_conn_string(DB_URI) as checkpointer:
        builder_key = StateGraph(chat_user_doc)
        builder_key.add_node("main_node",Ai_Chat_Node)
        builder_key.add_edge(START, "main_node")
        graph = builder_key.compile(checkpointer=checkpointer)
        await checkpointer.setup() 
        config = {"configurable": {"thread_id":data[0]}}

        # history = list(graph.get_state_history(config))
        snapshot = await graph.aget_state(config)
        all_messages = snapshot.values
        result = await graph.ainvoke(
            input= {"messages": [
                HumanMessage(content='')],
                "document":data[1],
                "history":all_messages,
                "currMsg":data[2]
            },
            config=config
        )
        data_be_passed = json.loads(result["messages"][-1].content)
        return {"messages": [AIMessage(content=data_be_passed[-1]["text"])]}
  
# input state   
class ai_improve_text(MessagesState):
    query:str
 
## Agent to correct and enhace sentenece
async def Ai_Improve(state:ai_improve_text):
    """ Improve the user query. """
    system_prompt = (
        f""" you are to improve the users input by correcting all tenses and gramatic errors and also making the sentence more professional,
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
    # print(messages_invoke.content)
    return {"messages": [AIMessage(content=json.dumps(messages_invoke.content))]}

async def Build_Improve_Text(data:str):
    builder_key = StateGraph(ai_improve_text)
    builder_key.add_node("main_node", Ai_Improve)
    builder_key.add_edge(START, "main_node")
    graph = builder_key.compile(checkpointer=None)
    print(data)

    result = await graph.ainvoke(
        input= {"messages": [
            HumanMessage(content='')],
            "query":data
        },
    )
    data_be_passed = json.loads(result["messages"][-1].content)
    return {"messages": [AIMessage(content=data_be_passed[-1]["text"])]}
  
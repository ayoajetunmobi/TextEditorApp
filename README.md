## Document Generator and Office Tool built with Generative AI

**An application which helps you generate precised document templates from our knowledge base of already formated documents, 
it further allows you explore a document using Artificial intelligence finally it gives room for various document or file conversion**

### Technology
1. FastApi
2. Next.js
3. Node.js
4. Redis
5. LangGraph
6. Ollama
7. Websockets

### Getting Started
clone github repository

#### Setup
	settup ollama locally with any model of your choice
	
	create an account with google ai studio and get an API token for gemma
	
	create an .env file in the AI folder
	
	paste the following code in the file
	```GOOGLE_API_KEY=API-OF-GEMMA-LLM ```

	install docker desktop for windows and start up a redis container running on the default port

make sure you have python(3.12 precisely) and node installed on your machine

**Note if you  have different versions of python, you must set your preffered interpreter in vscode**

create a virtual env for python
```
	python -m venv env
```
install all requirements in the requirements.txt file

startup your fastapi server.

npm install for node and next.js
and startup their respective servers

head over to browser and interact with the application.


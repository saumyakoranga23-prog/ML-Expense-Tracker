Before running this do npm install

Node.js needed to run in local host

In terminal 1 run this:

cd frontend
npm run dev

In terminal 2 run this:

cd backend
.\.venv\Scripts\Activate.ps1                             
>> uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
#!/bin/bash
cd /home/kavia/workspace/code-generation/notemaster-538-14ba47eb/notes_frontend_workspace/notes_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi


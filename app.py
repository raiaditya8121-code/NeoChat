# from flask import Flask, render_template, request, jsonify, session
# from google import genai
# import uuid
# import json
# import os
# from datetime import datetime

# app = Flask(__name__)
# app.secret_key = "chatai_secret_key_2025"

# # =============================================
# # FREE API: Google Gemini (gemini-1.5-flash)
# # Get your free API key: https://aistudio.google.com/
# # =============================================
# GEMINI_API_KEY = "AIzaSyBKWRimIjEqErKxyKFHhjxURHCIstUvmvg"
# genai.configure(api_key=GEMINI_API_KEY)

# model = genai.GenerativeModel("gemini-1.5-flash")
# # In-memory storage for chat histories
# chat_histories = {}

# # ─────────────────────────────────────────────
# # ROUTES
# # ─────────────────────────────────────────────

# @app.route("/")
# def index():
#     if "user_id" not in session:
#         session["user_id"] = str(uuid.uuid4())
#     return render_template("index.html")


# @app.route("/api/chat", methods=["POST"])
# def chat():
#     data = request.get_json()
#     user_message = data.get("message", "").strip()
#     conversation_id = data.get("conversation_id")
#     system_prompt = data.get("system_prompt", "")

#     if not user_message:
#         return jsonify({"error": "Message cannot be empty"}), 400

#     user_id = session.get("user_id", "default")
#     key = f"{user_id}_{conversation_id}"

#     # Build history
#     if key not in chat_histories:
#         chat_histories[key] = []

#     history = chat_histories[key]

#     # Build full prompt with system context
#     full_prompt = ""
#     if system_prompt:
#         full_prompt = f"[System: {system_prompt}]\n\n"

#     # Include recent history (last 10 turns)
#     for msg in history[-10:]:
#         role = "User" if msg["role"] == "user" else "Assistant"
#         full_prompt += f"{role}: {msg['content']}\n"

#     full_prompt += f"User: {user_message}\nAssistant:"

#     try:
#         response = model.generate_content(full_prompt)
#         assistant_reply = response.text

#         # Save to history
#         history.append({"role": "user", "content": user_message, "time": datetime.now().isoformat()})
#         history.append({"role": "assistant", "content": assistant_reply, "time": datetime.now().isoformat()})
#         chat_histories[key] = history

#         return jsonify({
#             "reply": assistant_reply,
#             "conversation_id": conversation_id
#         })
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500


# @app.route("/api/conversations", methods=["GET"])
# def get_conversations():
#     """Return list of all conversation IDs and their first message."""
#     user_id = session.get("user_id", "default")
#     conversations = []

#     for key, history in chat_histories.items():
#         if key.startswith(user_id) and history:
#             conv_id = key.replace(f"{user_id}_", "")
#             first_msg = next((m["content"] for m in history if m["role"] == "user"), "New Chat")
#             conversations.append({
#                 "id": conv_id,
#                 "title": first_msg[:50] + ("..." if len(first_msg) > 50 else ""),
#                 "time": history[0].get("time", ""),
#                 "message_count": len(history)
#             })

#     conversations.sort(key=lambda x: x["time"], reverse=True)
#     return jsonify(conversations)


# @app.route("/api/conversation/<conv_id>", methods=["GET"])
# def get_conversation(conv_id):
#     """Get full history of a conversation."""
#     user_id = session.get("user_id", "default")
#     key = f"{user_id}_{conv_id}"
#     history = chat_histories.get(key, [])
#     return jsonify(history)


# @app.route("/api/conversation/<conv_id>", methods=["DELETE"])
# def delete_conversation(conv_id):
#     """Delete a conversation."""
#     user_id = session.get("user_id", "default")
#     key = f"{user_id}_{conv_id}"
#     if key in chat_histories:
#         del chat_histories[key]
#     return jsonify({"success": True})


# @app.route("/api/conversation/rename", methods=["POST"])
# def rename_conversation():
#     data = request.get_json()
#     user_id = session.get("user_id", "default")
#     conv_id = data.get("id")
#     new_title = data.get("title", "")
#     key = f"{user_id}_{conv_id}"
#     if key in chat_histories and chat_histories[key]:
#         chat_histories[key][0]["custom_title"] = new_title
#     return jsonify({"success": True})


# @app.route("/api/clear-all", methods=["DELETE"])
# def clear_all():
#     user_id = session.get("user_id", "default")
#     keys_to_delete = [k for k in chat_histories if k.startswith(user_id)]
#     for k in keys_to_delete:
#         del chat_histories[k]
#     return jsonify({"success": True})


# @app.route("/api/health")
# def health():
#     return jsonify({"status": "ok", "model": "gemini-1.5-flash"})


# if __name__ == "__main__":
#     app.run(debug=True, port=5000)











from flask import Flask, render_template, request, jsonify, session
import uuid
from datetime import datetime
import requests

app = Flask(__name__)
app.secret_key = "chatai_secret_key_2025"

# =========================
# GROQ API SETUP
# =========================
GROQ_API_KEY = "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"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# In-memory chat storage
chat_histories = {}

# =========================
# HOME
# =========================
@app.route("/")
def index():
    if "user_id" not in session:
        session["user_id"] = str(uuid.uuid4())
    return render_template("index.html")

# =========================
# CHAT API
# =========================
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()
    conversation_id = data.get("conversation_id")

    if not user_message:
        return jsonify({"error": "Message cannot be empty"}), 400

    user_id = session.get("user_id", "default")
    key = f"{user_id}_{conversation_id}"

    if key not in chat_histories:
        chat_histories[key] = []

    history = chat_histories[key]

    # Build messages for Groq (OpenAI format)
    messages = []

    # add history (last 10)
    for msg in history[-10:]:
        messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    # add new user message
    messages.append({
        "role": "user",
        "content": user_message
    })

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}"
    }

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": messages
    }

    try:
        response = requests.post(GROQ_URL, json=payload, headers=headers)
        result = response.json()

        assistant_reply = result["choices"][0]["message"]["content"]

        # save history
        history.append({
            "role": "user",
            "content": user_message,
            "time": datetime.now().isoformat()
        })

        history.append({
            "role": "assistant",
            "content": assistant_reply,
            "time": datetime.now().isoformat()
        })

        chat_histories[key] = history

        return jsonify({
            "reply": assistant_reply,
            "conversation_id": conversation_id
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================
# CONVERSATIONS
# =========================
@app.route("/api/conversations", methods=["GET"])
def get_conversations():
    user_id = session.get("user_id", "default")
    conversations = []

    for key, history in chat_histories.items():
        if key.startswith(user_id) and history:
            conv_id = key.replace(f"{user_id}_", "")
            first_msg = next((m["content"] for m in history if m["role"] == "user"), "New Chat")

            conversations.append({
                "id": conv_id,
                "title": first_msg[:50],
                "time": history[0].get("time", ""),
                "message_count": len(history)
            })

    conversations.sort(key=lambda x: x["time"], reverse=True)
    return jsonify(conversations)

# =========================
# GET CHAT
# =========================
@app.route("/api/conversation/<conv_id>", methods=["GET"])
def get_conversation(conv_id):
    user_id = session.get("user_id", "default")
    key = f"{user_id}_{conv_id}"
    return jsonify(chat_histories.get(key, []))

# =========================
# DELETE CHAT
# =========================
@app.route("/api/conversation/<conv_id>", methods=["DELETE"])
def delete_conversation(conv_id):
    user_id = session.get("user_id", "default")
    key = f"{user_id}_{conv_id}"
    if key in chat_histories:
        del chat_histories[key]
    return jsonify({"success": True})

# =========================
# CLEAR ALL
# =========================
@app.route("/api/clear-all", methods=["DELETE"])
def clear_all():
    user_id = session.get("user_id", "default")
    keys_to_delete = [k for k in chat_histories if k.startswith(user_id)]

    for k in keys_to_delete:
        del chat_histories[k]

    return jsonify({"success": True})

# =========================
# HEALTH CHECK
# =========================
@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "model": "llama-3.1-8b-instant (groq)"
    })

# =========================
# RUN APP
# =========================
if __name__ == "__main__":
    app.run(debug=True, port=5000)
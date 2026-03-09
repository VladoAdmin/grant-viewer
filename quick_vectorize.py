#!/usr/bin/env python3
"""Quick vectorization of grant calls for search"""
import os
import psycopg2
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Connect to Supabase
conn = psycopg2.connect(
    host="aws-1-eu-central-1.pooler.supabase.com",
    port=6543,
    database="postgres",
    user="postgres.kapgabgnezcurmgcrvif",
    password=os.getenv("SUPABASE_PASSWORD")
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_embedding(text):
    """Generate embedding using OpenAI"""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text[:8000]  # Limit input size
    )
    return response.data[0].embedding

def main():
    cur = conn.cursor()

    # Get all grant calls
    cur.execute("""
        SELECT id, title, provider, call_type, total_allocation 
        FROM grant_calls_v2
    """)
    calls = cur.fetchall()

    print(f"Processing {len(calls)} grant calls...")

    for call_id, title, provider, call_type, allocation in calls:
        # Combine fields into searchable text
        text = f"{title or ''}. Provider: {provider or ''}. Type: {call_type or ''}. Allocation: {allocation or ''}"

        if not text.strip():
            continue

        try:
            embedding = get_embedding(text)

            # Insert into v2_call_chunks
            cur.execute("""
                INSERT INTO v2_call_chunks (call_id, content, embedding, source)
                VALUES (%s, %s, %s::vector, %s)
            """, (call_id, text, str(embedding), 'grant_calls_v2'))

            conn.commit()
            print(f"✓ Processed call {call_id}: {title[:50]}...")

        except Exception as e:
            print(f"✗ Error processing call {call_id}: {e}")
            conn.rollback()

    cur.close()
    conn.close()
    print("Done!")

if __name__ == "__main__":
    main()

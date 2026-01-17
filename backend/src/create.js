import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName, json, uid } from "./_lib.js";

export async function handler(event) {
  const body = event?.body ? JSON.parse(event.body) : {};
  const text = String(body?.text ?? "").trim();
  if (!text) return json(400, { message: "text is required" });

  const todo = { id: uid(), text, createdAt: new Date().toISOString() };

  if (!tableName) return json(500, { message: "TODOS_TABLE is not configured" });

  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: { pk: todo.id, text: todo.text, createdAt: todo.createdAt },
    })
  );

  return json(201, todo);
}

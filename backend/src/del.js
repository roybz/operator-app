import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName, json } from "./_lib.js";

export async function handler(event) {
  const id = event?.pathParameters?.id;
  if (!id) return json(400, { message: "id is required" });

  if (!tableName) return json(500, { message: "TODOS_TABLE is not configured" });

  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { pk: id },
    })
  );

  return { statusCode: 204, headers: { "cache-control": "no-store" }, body: "" };
}

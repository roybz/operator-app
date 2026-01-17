import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName, json } from "./_lib";

export async function handler(event: any) {
  const id = event?.pathParameters?.id;
  if (!id) return json(400, { message: "id is required" });

  await ddb.send(new DeleteCommand({
    TableName: tableName,
    Key: { pk: id }
  }));

  return { statusCode: 204, headers: { "cache-control": "no-store" }, body: "" };
}


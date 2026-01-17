import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tableName, json } from "./_lib";

export async function handler() {
  const out = await ddb.send(new ScanCommand({ TableName: tableName }));
  const items = (out.Items ?? [])
    .map(x => ({
      id: x.pk,
      text: x.text,
      createdAt: x.createdAt
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return json(200, items);
}


import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const tableName = process.env.TODOS_TABLE;
export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

export function uid() {
  // good-enough unique id without dependencies
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

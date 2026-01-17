import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModules() {
  process.env.TODOS_TABLE = 'Todos';
  const lib = await import('../src/_lib.js');
  const create = await import('../src/create.js');
  const list = await import('../src/list.js');
  const del = await import('../src/del.js');
  return { lib, create, list, del };
}

test('create handler returns 201 and echoes todo', async () => {
  const { lib, create } = await loadModules();
  let sentItem;
  lib.ddb.send = async (cmd) => {
    sentItem = cmd.input?.Item;
    return {};
  };

  const res = await create.handler({ body: JSON.stringify({ text: 'Hello' }) });
  assert.equal(res.statusCode, 201);
  const body = JSON.parse(res.body);
  assert.equal(body.text, 'Hello');
  assert.equal(sentItem.text, 'Hello');
  assert.ok(body.id);
});

test('list handler returns sorted todos', async () => {
  const { lib, list } = await loadModules();
  lib.ddb.send = async () => ({
    Items: [
      { pk: '1', text: 'First', createdAt: '2026-01-01T00:00:00.000Z' },
      { pk: '2', text: 'Second', createdAt: '2026-01-02T00:00:00.000Z' },
    ],
  });

  const res = await list.handler();
  assert.equal(res.statusCode, 200);
  const items = JSON.parse(res.body);
  assert.equal(items[0].id, '2');
  assert.equal(items[1].id, '1');
});

test('delete handler returns 204', async () => {
  const { lib, del } = await loadModules();
  let deletedKey;
  lib.ddb.send = async (cmd) => {
    deletedKey = cmd.input?.Key;
    return {};
  };

  const res = await del.handler({ pathParameters: { id: 't_1' } });
  assert.equal(res.statusCode, 204);
  assert.deepEqual(deletedKey, { pk: 't_1' });
});

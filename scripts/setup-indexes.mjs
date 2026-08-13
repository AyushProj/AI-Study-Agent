import clientPromise from "../lib/db.js";

async function main() {
  const client = await clientPromise;
  const db = client.db();
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  console.log("Index created: users.email (unique)");
  process.exit(0);
}

main();
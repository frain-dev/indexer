const { MongoClient } = require("mongodb");
const Typesense = require("typesense");
const { flatten } = require("flat");
const { config } = require("dotenv");
const thread = require("child_process");

async function run() {
  config();

  let client = null;
  try {
    const uri = process.env.DB_DSN;
    client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const collection = client
      .db(process.env.DB_NAME)
      .collection(process.env.COLLECTION);
    const typesense = new Typesense.Client({
      nodes: [
        {
          host: process.env.TYPESENSE_HOST,
          port: process.env.TYPESENSE_PORT,
          protocol: "https",
        },
      ],
      connectionTimeoutSeconds: 1000,
      apiKey: process.env.API_KEY,
    });

    typesense
      .collections(process.env.COLLECTION)
      .retrieve()
      .catch(async () => {
        await typesense.collections().create({
          name: process.env.COLLECTION,
          fields: [{ name: ".*", type: "auto" }],
        });
      });

    const changeStream = collection.watch();
    changeStream.on("change", (doc) => {
      if (doc.operationType === "insert") {
        const document = transform(doc.fullDocument);
        typesense
          .collections(process.env.COLLECTION)
          .documents()
          .upsert(document)
          .catch(console.error);
      }
    });

    changeStream.on("error", console.error);
  } catch (e) {
    console.error(e);
  }
}

function transform(doc) {
  doc.data = JSON.parse(doc.data.toString("utf8"));
  doc = flatten(doc);

  doc.id = doc._id.toHexString();
  delete doc._id;

  doc.created_at = new Date(doc.created_at).getTime();
  doc.updated_at = new Date(doc.updated_at).getTime();

  return doc;
}

run().catch(console.error);

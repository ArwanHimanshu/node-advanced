const mongoose = require("mongoose");
const util = require("util");
const redis = require("redis");
const keys = require("../config/keys");
const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || "");
  return this;
};

mongoose.Query.prototype.exec = async function () {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );
  const cachedValue = await client.hget(this.hashKey, key);
  if (cachedValue) {
    const value = JSON.parse(cachedValue);
    const doc = Array.isArray(value)
      ? value.map((r) => new this.model(r))
      : new this.model(value);
    return doc;
  }
  console.log(key);
  const result = await exec.apply(this, arguments);
  console.log(result);
  client.hset(this.hashKey, key, JSON.stringify(result));
  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};

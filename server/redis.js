"use strict";

const REDIS_URI = process.env.REDIS_URI || "redis://172.17.0.1:9000";

const redis = require("redis");
const redisClient = redis.createClient(REDIS_URI);

module.exports = {
    cachePosts: function (posts) {
        posts.forEach((post, i) => {
            post._id = post._id.toString()
            redisClient.hmset(`post:${i}`, post, redis.print)
        })
    },

    sendRedisPost: function (callback) {
        let posts = [];
        redisClient.keys("post:*", (err, keys) => {
            let end = keys.length;
            keys.forEach((key, i) => {
                redisClient.hgetall(key, (err, msg) => {
                    posts.push(msg)
                    if(--end === 0) { callback(posts) }
                })
            })
        })
    },
}

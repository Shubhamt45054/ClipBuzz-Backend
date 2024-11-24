import { Router } from 'express';
import {
  createTweet,
  getUserTweets,
  updateTweet,
  deleteTweet,
  getAllTweets,
  getAllUserFeedTweets,
} from "../controllers/tweet.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router();
router.use(verifyJWT);

router.route("/").get(getAllTweets).post(createTweet);
router.route("/user/:userId").get(getUserTweets);
router.route("/:tweetId").patch(updateTweet).delete(deleteTweet);
router.route("/feed").get(getAllUserFeedTweets);

export default router
import { Router } from 'express';
import {
    getLikedVideos,
    toggleCommentLike,
    toggleVideoLike,
    toggleTweetLike,
    toggleLike
} from "../controllers/like.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router();

console.log("like route mei hoo ..");

router.use(verifyJWT); 

router.route("/").patch(toggleLike);
router.route("/comment/:commentId").patch(toggleCommentLike);
router.route("/tweet/:tweetId").patch(toggleTweetLike);
router.route("/video/:videoId").patch(toggleVideoLike);
router.route("/videos").get(getLikedVideos);

export default router
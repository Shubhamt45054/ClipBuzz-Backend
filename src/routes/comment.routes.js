import { Router } from 'express';
import {
    addComment,
    deleteComment,
    getVideoComments,
    updateComment,
} from "../controllers/comment.controller.js"
import {verifyJWT,checkUser} from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/get/:videoId").get(checkUser,getVideoComments);

 router.use(verifyJWT);
router.route("/add/:videoId").post(addComment);
router.route("/c/:commentId").delete(deleteComment).patch(updateComment);

export default router
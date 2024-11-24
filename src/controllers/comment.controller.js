import mongoose, { isValidObjectId } from "mongoose";
import {Comment} from "../models/comment.model.js"
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {

    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid VideoId");

  const options = {
    page,
    limit,
  };

  const video = await Video.findById(videoId);

  const allComments = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
        pipeline: [
          {
            $match: {
              liked: true,
            },
          },
          {
            $group: {
              _id: "liked",
              owners: { $push: "$likedBy" },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "dislikes",
        pipeline: [
          {
            $match: {
              liked: false,
            },
          },
          {
            $group: {
              _id: "liked",
              owners: { $push: "$likedBy" },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likes: {
          $cond: {
            if: {
              $gt: [{ $size: "$likes" }, 0],
            },
            then: { $first: "$likes.owners" },
            else: [],
          },
        },
        dislikes: {
          $cond: {
            if: {
              $gt: [{ $size: "$dislikes" }, 0],
            },
            then: { $first: "$dislikes.owners" },
            else: [],
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullName: 1,
              username: 1,
              avatar: 1,
              _id: 1,
            },
          },
        ],
      },
    },
    { $unwind: "$owner" },
    {
      $project: {
        content: 1,
        owner: 1,
        createdAt: 1,
        updatedAt: 1,
        likes:1,
        isOwner: {
          $cond: {
            if: { $eq: [req.user?._id, "$owner._id"] },
            then: true,
            else: false,
          },
        },
        likesCount: {
          $size: "$likes",
        },
        disLikesCount: {
          $size: "$dislikes",
        },
        isLiked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$likes"],
            },
            then: true,
            else: false,
          },
        },
        isDisLiked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$dislikes"],
            },
            then: true,
            else: false,
          },
        },
        isLikedByVideoOwner:{
          $cond: {
            if: {
              $in: [video.owner, "$likes"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
  ]);

  return res
  .status(200)
  .json(new ApiResponse(200, allComments, "All comments Sent"));

})

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;
    console.log("add comment")
    console.log(req.user.username);
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid VideoId");
  if (!content) throw new ApiError(400, "No Comment Found");

  const comment = await Comment.create(
    {
    content,
    video: videoId,
    owner: req.user?._id,
    }
  )
  if (!comment) throw new ApiError(500, "Error while adding comment");
     
  const { username, avatar, fullName, _id } = req.user;

  const commentInfo = {
    ...comment._doc,
    owner: { username, avatar, fullName, _id },
    likesCount: 0,
    isOwner: true,
  };


  return res
  .status(200)
  .json(
    new ApiResponse(200,commentInfo,"Comment succesfullay created")
  )


})

const updateComment = asyncHandler(async (req, res) => {

    const { commentId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid VideoId");
    if (!content) throw new ApiError(400, "No Comment Found");

    const comment = await Comment.findByIdAndUpdate(
        commentId,
        {
                $set:
                { 
                    content
                }
        },
        {
          new: true,
        }
    )
    if (!newComment) throw new ApiError(500, "Error while editing comment");

    return res
    .status(200)
    .json(new ApiResponse(200, newComment, "Comment updated successfully"));

})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    if(!isValidObjectId(commentId)) return new ApiError(400,"Error in comment id");

    const comment = await Comment.findByIdAndDelete(commentId);

  if (!comment) throw new ApiError(500, "Error while deleting comment");

  const deleteLikes = await Like.deleteMany({
    comment: commentId,
  });

   return res
    .status(200)
    .json(
      new ApiResponse(200, { isDeleted: true }, "Comment deleted successfully")
    );
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }

import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary,
        deleteImageOnCloudinary,
        deleteVideoOnCloudinary,
} from "../utils/cloudinary.js"
import { stopWords } from "../utils/helperData.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Playlist } from "../models/playlist.model.js";
import fs from "fs";


 const getAllVideosByOption = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy,
      sortType = "video",
      order,
      userId,
    } = req.query;

    let filters = { isPublished: true };

    if (isValidObjectId(userId))
      filters.owner = new mongoose.Types.ObjectId(userId);

    let pipeline = [
      {
        $match: {
          ...filters,
        },
      },
    ];
  
    const sort = {};

    if (search) {
      const queryWords = search
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .split(" ");
      const filteredWords = queryWords.filter(
        (word) => !stopWords.includes(word)
      );
  
      console.log("search: ", search);
      console.log("filteredWords: ", filteredWords);
  
      pipeline.push({
        $addFields: {
          titleMatchWordCount: {
            $size: {
              $filter: {
                input: filteredWords,
                as: "word",
                cond: {
                  $in: ["$$word", { $split: [{ $toLower: "$title" }, " "] }],
                },
              },
            },
          },
        },
      });
  
      pipeline.push({
        $addFields: {
          descriptionMatchWordCount: {
            $size: {
              $filter: {
                input: filteredWords,
                as: "word",
                cond: {
                  $in: [
                    "$$word",
                    { $split: [{ $toLower: "$description" }, " "] },
                  ],
                },
              },
            },
          },
        },
      });
  
      sort.titleMatchWordCount = -1;
    }

    if (sortBy) {
      sort[sortBy] = parseInt(order);
    } else if (!search && !sortBy) {
      sort["createdAt"] = -1;
    }
  
    pipeline.push({
      $sort: {
        ...sort,
      },
    });

    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$owner",
      }
    );
  
    const videoAggregate = Video.aggregate(pipeline);
  
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    };
  
    const allVideos = await Video.aggregatePaginate(videoAggregate, options);
  
    const { docs, ...pagingInfo } = allVideos;
  
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { videos: docs, pagingInfo },
          "All Query Videos Sent Successfully"
        )
      );
  });

const getAllVideos = asyncHandler(async (req, res) => {
  
    const { userId } = req.query;

  let filters = { isPublished: true };
  if (isValidObjectId(userId))
    filters.owner = new mongoose.Types.ObjectId(userId);

  let pipeline = [
    {
      $match: {
        ...filters,
      },
    },
  ];

  pipeline.push({
    $sort: {
      createdAt: -1,
    },
  });

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$owner",
    }
  );

  const allVideos = await Video.aggregate(Array.from(pipeline));

  return res
    .status(200)
    .json(new ApiResponse(200, allVideos, "all videos sent"));

});

const publishAVideo = asyncHandler( async (req, res) => {

    const { title, description } = req.body;

    if (!title) throw new ApiError(400, "Title is Required");

    let videoFileLocalFilePath = null;
    if (req.files && req.files.videoFile && req.files.videoFile.length > 0) {
      videoFileLocalFilePath = req.files.videoFile[0].path;
    }
    if (!videoFileLocalFilePath)
      throw new ApiError(400, "Video File Must be Required");
  

    let thumbnailLocalFilePath = null;
    if (req.files && req.files.thumbnail && req.files.thumbnail.length > 0) {
      thumbnailLocalFilePath = req.files.thumbnail[0].path;
    }

    if (!thumbnailLocalFilePath)
      throw new ApiError(400, "Thumbnail File Must be Required");
  
  if (req.customConnectionClosed) {
    console.log("Connection closed, aborting video and thumbnail upload...");
    console.log("All resources Cleaned up & request closed...");
    return; 
  }


    const videoFile = await uploadOnCloudinary(videoFileLocalFilePath);
    if (!videoFile) throw new ApiError(500, "Error while Uploading Video File");

  if (req.customConnectionClosed) {
    console.log(
      "Connection closed!!! deleting video and aborting thumbnail upload..."
    );
    await deleteVideoOnCloudinary(videoFile.url);
    fs.unlinkSync(thumbnailLocalFilePath);
    console.log("All resources Cleaned up & request closed...");
    return; 
  }
  
    const thumbnailFile = await uploadOnCloudinary(thumbnailLocalFilePath);
    if (!thumbnailFile)
      throw new ApiError(500, "Error while uploading thumbnail file");

      if (req.customConnectionClosed) {
    console.log(
      "Connection closed!!! deleting video & thumbnail and aborting db operation..."
    );
    await deleteVideoOnCloudinary(videoFile.url);
    await deleteImageOnCloudinary(thumbnailFile.url);
    console.log("All resources Cleaned up & request closed...");
    return; 
  }

    console.log("updating db...");
  console.log(req.user);
    const video = await Video.create({
      videoFile: videoFile.url,
      title,
      description: description || "",
      duration: videoFile.duration,
      thumbnail: thumbnailFile.url,
      owner: req.user?._id,
    });

    if (!video) throw new ApiError(500, "Error while Publishing Video");

    if (req.customConnectionClosed) {
    console.log(
      "Connection closed!!! deleting video & thumbnail & dbEntry and aborting response..."
    );
    await deleteVideoOnCloudinary(videoFile.url);
    await deleteImageOnCloudinary(thumbnailFile.url);
    let video = await Video.findByIdAndDelete(video._id);
    console.log("Deleted the Video from db: ", video);
    console.log("All resources Cleaned up & request closed...");
    return;
  }
  
    return res
      .status(200)
      .json(new ApiResponse(200, video, "Video published successfully"));

});

const getVideoById = asyncHandler(async (req, res) => {

    const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.aggregate([
    {

      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
        isPublished: true,
      },
    },
   
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
        pipeline: [
          {
            $match: {
              liked: true,
            },
          },
          {
            $group: {
              _id: "$liked",
              likeOwners: { $push: "$likedBy" },
            },
          },
        ],
      },
    },

    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "dislikes",
        pipeline: [
          {
            $match: {
              liked: false,
            },
          },
          {
            $group: {
              _id: "$liked",
              dislikeOwners: { $push: "$likedBy" },
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
            then: { $first: "$likes.likeOwners" },
            else: [],
          },
        },
        dislikes: {
          $cond: {
            if: {
              $gt: [{ $size: "$dislikes" }, 0],
            },
            then: { $first: "$dislikes.dislikeOwners" },
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
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$owner",
    },
  
    {
      $project: {
        videoFile: 1,
        title: 1,
        description: 1,
        duration: 1,
        thumbnail: 1,
        views: 1,
        owner: 1,
        createdAt: 1,
        updatedAt: 1,
        totalLikes: {
          $size: "$likes",
        },
        totalDisLikes: {
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
      },
    },
  ]);

  if (!video.length > 0) throw new ApiError(400, "No video found");

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video sent successfully"));
})

const updateVideo = asyncHandler(async (req, res) => {

    const { videoId } = req.params;
    const { title, description } = req.body;
  

    if (!isValidObjectId(videoId)) throw new APIError(400, "Invalid VideoId...");
    const thumbnailLocalFilePath = req.file?.path;
    if (!title && !description && !thumbnailLocalFilePath) {
      throw new ApiError(400, "At-least one field required");
    }
  
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "video not found");
  
    if (video.owner.toString() !== req.user?._id.toString())
      throw new ApiError(401, "Only owner can modify video details");

    let thumbnail;
    if (thumbnailLocalFilePath) {
      thumbnail = await uploadOnCloudinary(thumbnailLocalFilePath);
      if (!thumbnail)
        throw new APIError(500, "Error accured while uploading photo");
  
      await deleteImageOnCloudinary(video.thumbnail);
    }
    if (title) video.title = title;
    if (description) video.description = description;
    if (thumbnail) video.thumbnail = thumbnail.url;
 
    const updatedVideo = await video.save({ validateBeforeSave: false });
  
    if (!updatedVideo) {
      throw new ApiError(500, "Error while Updating Details");
    }
  
    return res
      .status(200)
      .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
})

const deleteVideo = asyncHandler(async (req, res) => {

    const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "VideoId not found");

  const findRes = await Video.findByIdAndDelete(videoId);

  if (!findRes) throw new ApiError(400, "Video not found");

  await deleteVideoOnCloudinary(findRes.videoFile);

  const deleteVideoLikes = await Like.deleteMany({
    video: new mongoose.Types.ObjectId(videoId),
  });

  const videoComments = await Comment.find({
    video: new mongoose.Types.ObjectId(videoId),
  });

  const commentIds = videoComments.map((comment) => comment._id);

  const deleteCommentLikes = await Like.deleteMany({
    comment: { $in: commentIds },
  });

  const deleteVideoComments = await Comment.deleteMany({
    video: new mongoose.Types.ObjectId(videoId),
  });

  const deleteVideoFromPlayList = await Playlist.updateMany(
    {},
    { $pull: { videos: new mongoose.Types.ObjectId(videoId) } }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, [], "Video deleted successfully"));
})

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) throw new ApiError(400, "videoId required");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(400, "Video not found");

  video.isPublished = !video.isPublished;
  const updatedVideo = await video.save();

  if (!updatedVideo) throw new ApiError(400, "Failed to toggle publish status");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isPublished: updatedVideo.isPublished },
        "Video toggled successfully"
      )
    );
})

const updateView = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "videoId required");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(400, "Video not found");

  video.views += 1;
  const updatedVideo = await video.save();
  if (!updatedVideo) throw new ApiError(400, "Error occurred on updating view");

  let watchHistory;
  if (req.user) {
    watchHistory = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $push: {
          watchHistory: new mongoose.Types.ObjectId(videoId),
        },
      },
      {
        new: true,
      }
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isSuccess: true, views: updatedVideo.views, watchHistory },
        "Video views updated successfully"
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
  updateView,
  getAllVideosByOption
}

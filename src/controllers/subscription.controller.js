import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {

    const { channelId } = req.params;

    if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid ChannelId");
  
    let isSubscribed;
  
    const findRes = await Subscription.findOne({
      subscriber: req.user?._id,
      channel: channelId,
    });
  
    if (findRes) {
        // delete ...
      const res = await Subscription.deleteOne({
        subscriber: req.user?._id,
        channel: channelId,
      });
      isSubscribed = false;
    } else {
        // create ...
      const newSub = await Subscription.create({
        subscriber: req.user?._id,
        channel: channelId,
      });
      if (!newSub) throw new APIError(500, "Failed to toggle Subscription");
      isSubscribed = true;
    }
  
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isSubscribed },
          `${isSubscribed ? "Subscribed successfully" : "Un-Subscribed successfully"}`
        )
      );
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {

    const { channelId = req.user?._id } = req.params;

  if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid ChannelId");

  const subscriberList = await Subscription.aggregate([
    {

      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {

      $lookup: {
        from: "subscriptions",
        localField: "channel",
        foreignField: "subscriber",
        as: "subscribedChannels",
      },
    },
    {

      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribersSubscribers",
            },
          },
          {
            $project: {
              username: 1,
              avatar: 1,
              fullName: 1,
              subscribersCount: {
                $size: "$subscribersSubscribers",
              },
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$subscriber",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        "subscriber.isSubscribed": {
          $cond: {
            if: {
              $in: ["$subscriber._id", "$subscribedChannels.channel"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $group: {
        _id: "channel",
        subscriber: {
          $push: "$subscriber",
        },
      },
    },
  ]);

  const subscribers =
    subscriberList?.length > 0 ? subscriberList[0].subscriber : [];

  return res
    .status(200)
    .json(new ApiResponse(200, subscribers, "Subscriber Sent Successfully"));
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {

  const { subscriberId } = req.params;
      console.log(subscriberId);
  if (!isValidObjectId(subscriberId))
    throw new ApiError(400, "Invalid subscriberId");

  const subscribedChannels = await Subscription.aggregate([

    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
        pipeline: [
          {
            $project: {
              fullName: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$channel",
    },

    {
      $lookup: {
        from: "subscriptions",
        localField: "channel._id",
        foreignField: "channel",
        as: "channelSubscribers",
      },
    },
    {

      $addFields: {
        "channel.isSubscribed": {
          $cond: {
            if: { $in: [req.user?._id, "$channelSubscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
        "channel.subscribersCount": {
          $size: "$channelSubscribers",
        },
      },
    },
    {
      $group: {
        _id: "subscriber",
        subscribedChannels: {
          $push: "$channel",
        },
      },
    },
  ]);

  const users =
    subscribedChannels?.length > 0
      ? subscribedChannels[0].subscribedChannels
      : [];

  return res
    .status(200)
    .json(
      new ApiResponse(200, users, "Subscribed channel list sent successfully")
    );

})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
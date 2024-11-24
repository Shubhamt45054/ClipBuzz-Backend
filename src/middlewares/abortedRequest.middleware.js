import { asyncHandler } from "../utils/asyncHandler.js";

const checkAborted = asyncHandler((req, res, next) => {
  req.connection.on("close", () => {
    console.log("Request aborted by client!!!");
    req.customConnectionClosed = true;
  });
  req.customConnectionClosed = false;
  next();
});

export { checkAborted };

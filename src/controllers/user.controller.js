import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/users.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

//it will generate access and refresh token
const generateAccessAndRefreshTokens=async(userId) =>
{
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave:false});//no need for validation
        
        return {accessToken,refreshToken};
    }
    catch(error){
        throw new ApiError(500,"Something went wrong while generating refresh and access tokens");
    }
}


const registerUser=asyncHandler(async(req,res)=>{
    //get user detail from frontend
    //validation- not empty
    //check if user already exists:username , email
    //check for images, check for avatar
    //upload them to cloudinary, avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user created or not
    //return response

    const {fullname,email,username,password}=req.body
    // console.log("email",email)

    if(
        [fullname,email,username,password].some((field)=>
        field?.trim()==="" )
    )
    {
        throw new ApiError(400,"Please fill in all fields");
    }

    const existedUser=await User.findOne({
        $or:[{username},{email}]
    })
    if(existedUser){
        throw new ApiError(409,"User already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // console.log("req.files",req.files)
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }


    if(!avatarLocalPath){
        throw new ApiError(400,"Please provide an avatar image");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Please provide an avatar image");
    }

    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError(500,"something gone wrong while chacking the user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created successfully")
    );
})

const loginUser=asyncHandler(async(req,res)=>{
    // req body ->data
    // username or email
    //find the user
    //password check
    //access and refresh token
    //send cookies
    //return response

    const {email,username,password}=req.body;
    // console.log(`email`,email)
    if(!(username  ||email)){
        throw new ApiError(400,"Please provide username or email");
    }

    //alternave approach of above code if we require either of 
    //user name or email
    /*
    if(!username && !email){
        throw new ApiError(400,"Please provide username or email");
    }
    */
    
    
    
    const user = await User.findOne(
        {
            $or:[{username},{email}]//or is a mongo operator
        }
    )

    if(!user){
        throw new ApiError(404,"User does not exist!!!");
    }
    //we dont use User as it is a mongoose model but we must use user as it is the object made by us
    const isPaswordValid = await user.isPasswordCorrect(password);
    if(!isPaswordValid){
        throw new ApiError(401,"Invalid Credentials !!");
    }

    const {accessToken,refreshToken}= await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
        200,
        {
            user:loggedInUser, accessToken,refreshToken
        },
        "User Logged In Successfully"
    )
    )



})

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, {}, "User logged Out"))


})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
        
        const options={
            httpOnly:true,
            secure:true
        }
    
        const {accessToken, newRefreshToken}= await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || 
            "Invalid refresh token")
    }
})

const changeCurrentPassword =asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body




    const user = await User.findById(req.user?._id)
    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old Password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))
})

const getCurrentUser =asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname,email}= req.body
    if(!fullname||!email){
        throw new ApiError(400,"All fields are required")
    }

    const user=User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname:fullname,
                email:email
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))

})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user ,"Avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image file is missing")
    }

    const converImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!converImage.url){
        throw new ApiError(400,"Error while uploading on cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                converImage:converImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user ,"Cover image updated successfully")
    )
})

// Fetches the profile of a user channel along with subscription and subscriber information
const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params; // Extracting username from the URL parameters

    // Check if the username exists and is not empty
    if (!username?.trim) {
        throw new ApiError(400, "username is missing !!"); // Throw error if username is invalid
    }

    // Aggregation pipeline to fetch user channel details
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase() // Match the username in a case-insensitive manner
            },
        },
        {
            $lookup: { // Lookup subscribers of the channel
                from: "subscriptions", // Collection name to lookup
                localField: "_id", // Match User._id
                foreignField: "channel", // Match with the 'channel' field in subscriptions
                as: "subscribers" // Alias for the result
            }
        },
        {
            $lookup: { // Lookup channels the user has subscribed to
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber", // Match with the 'subscriber' field in subscriptions
                as: "subscribedTo"
            }
        },
        {
            $addFields: { // Add custom fields for additional information
                subscriberCount: { 
                    $size: "$subscribers" // Count the number of subscribers
                },
                channelsSubscribedToCount: { 
                    $size: "$subscribedTo" // Count the number of channels the user has subscribed to
                },
                isSubscribed: { 
                    $cond: { // Check if the logged-in user is subscribed to this channel
                        if: { $in: [req.user?._id, "subscribers.subscriber"] }, // Match user ID in subscribers
                        then: true, // Return true if subscribed
                        else: false // Return false if not subscribed
                    }
                }
            }
        },
        {
            $project: { // Select specific fields to return in the response
                fullname: 1,
                username: 1,
                subscriberCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            }
        }
    ]);

    // If no channel is found, throw a 404 error
    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist");
    }

    // Return the channel details in the response
    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "User channel fetched successfully")
        );
});

// Fetches the watch history of a user
const getWatchHistory = asyncHandler(async (req, res) => {
    // Aggregation pipeline to fetch user watch history
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id) // Match the logged-in user's ID
            }
        },
        {
            $lookup: { // Lookup watch history videos
                from: "Video", // Collection name to lookup
                localField: "watchHistory", // Match User.watchHistory
                foreignField: "_id", // Match with Video._id
                as: "watchHistory", // Alias for the result
                pipeline: [ // Nested pipeline to fetch video owner details
                    {
                        $lookup: { // Lookup video owner details
                            from: "users",
                            localField: "owner", // Match Video.owner
                            foreignField: "_id", // Match with User._id
                            as: "owner", // Alias for the result
                            pipeline: [ // Inner pipeline for owner projection
                                {
                                    $project: { // Select specific fields for the video owner
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: { // Add a single owner field
                            owner: {
                                $first: "$owner" // Get the first (and only) owner
                            }
                        }
                    }
                ]
            }
        }
    ]);

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "watch history fetched successfully"
        )
    )
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};

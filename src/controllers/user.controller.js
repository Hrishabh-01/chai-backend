import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/users.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

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

export {registerUser,loginUser,logoutUser,refreshAccessToken};

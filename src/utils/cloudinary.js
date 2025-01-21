import {v2 as cloudinary} from 'cloudinary';
import { response } from 'express';

import fs from "fs";//file system

//configuring cloudinary

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET     
});

const uploadOnCloudinary = async (localFilePath) => {
    try{
        if(!localFilePath)return null
        //upload the file in cloudinary

        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type: "auto",
        });
        //file has been uploaded successfully 
        // console.log(`File uploaded successfully on cloudinary`,response.url);
        fs.unlinkSync(localFilePath);//delete the file from local storage
        return response;
    }catch(error){
        fs.unlinkSync(localFilePath);//delete the file from local storage as upload operation failed
        return null;
    }
}

export {uploadOnCloudinary};
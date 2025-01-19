import mongoose from "mongoose";
import {DB_NAME} from "../constants.js";

const connectDB=async()=>{
    try{
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);//if by mistake be get connected to another databse it tells us
    }catch(error){
        console.log(`MONGODB connection FAILED `,error);
        process.exit(1);
    }
}

export default connectDB;
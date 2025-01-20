import mongoose,{Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"; 


const videoSchema= new Schema({
    videoFile:{
        type:String,//cloudinary url
        required:true,
    },
    thumbnail:{
        type:String,//cloudinary url
        required:true,
    },
    title:{
        type:String,//cloudinary url
        required:true,
    },
    description:{
        type:String,
        required:true,
    },
    duration:{
        type:Number,//cloudinary
        required:true,
    },
    views:{
        type:Number,
        default:0,
    },
    isPublished:{
        type:Boolean,
        default:true,
    },
    owner:{
        type:Schema.Types.ObjectId,
        ref:"User"
    }

},{timestamps:true}) //creating a schema


videoSchema.plugin(mongooseAggregatePaginate);//using the plugin
export const Video= mongoose.model("Video",videoSchema)   //exporting the model
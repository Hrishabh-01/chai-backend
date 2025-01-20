//method 1 using promise
const asyncHandler =(requestHandler)=>{
    return (req,res,next)=>{
        Promise.resolve(requestHandler(req,res,next)).catch((err)=>next(err))
    }
    
}

export {asyncHandler};

//it is wrapper function that 
// takes a function as an argument and returns a new function that 
// takes three arguments: req, res, and next. The new function calls the original 
// function and catches any errors that it throws. If an error occurs, the new function calls next with the error as an argument. 
// This allows us to handle errors in a single place, rather than having to add try/catch blocks to every route handler.

//method 2 using async await
/*
const asyncHandler=(fn)=>async (req,res,next)=>{
    try{
        await fn(req,res,next);
    }catch(error){
        res.status(error.code ||500).json({
            success: false,
            message:error.message
        })
    }
}*/
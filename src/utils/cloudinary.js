import {v2 as cloudinary} from "cloudinary"
import fs from "fs"
import 'dotenv/config'


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const uploadOnCloudinary = async(localFilePath)=> {
    try {
        if (!localFilePath) return null
        const response = await cloudinary.uploader
        .upload(localFilePath,{
            resource_type: "auto",
            folder: "playtube",
        })
        .catch((error) => {
            console.log(error);
        });
        await fs.unlinkSync(localFilePath)
        return response;
    }
    catch (error) {
        console.log("cloudnary pe nhi gya",error);
        fs.unlinkSync(localFilePath) 
        return null;
    }
}

const deleteImageOnCloudinary = async (publicUrl) => {
    try {
        console.log("Public URL:", publicUrl);
        let match = publicUrl.match(/(?:image|video)\/upload\/v\d+\/playtube\/(.+?)\.\w+$/);
        if (!match || match.length < 2) {
          console.log("Invalid URL format.");
          return null;
        } 
        let publicId = `playtube/${match[1]}`;
        console.log("Public ID to delete:", publicId);
    
        const response = await cloudinary.uploader.destroy(
            publicId,
         {
          resource_type: "image" 
        });
    
        console.log("File deleted successfully:", response);
        return response;
    } catch (error) {
      console.log("Failed to delete the file:", error);
      return null;
    }
  };

const deleteVideoOnCloudinary = async (publicUrl) => {
    try {
        console.log("Public URL:", publicUrl);

        let match = publicUrl.match(/(?:image|video)\/upload\/v\d+\/playtube\/(.+?)\.\w+$/);
        if (!match || match.length < 2) {
          console.log("Invalid URL format.");
          return null;
        }
        
        let publicId = `playtube/${match[1]}`;
        console.log("Public ID to delete:", publicId);

        const response = await cloudinary.uploader.destroy(
            publicId,
         {
          resource_type: "video" 
        });
        console.log("File deleted successfully:", response);
        return response;
    } catch (error) {
      console.log("Failed to delete the file:", error);
      return null;
    }
  };

export {uploadOnCloudinary,
        deleteImageOnCloudinary,
        deleteVideoOnCloudinary
}


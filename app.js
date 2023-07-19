
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const mongoose = require("mongoose");
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { auth } = require("./middleware");
const JWT_SECRET = process.env.JWT_SECRET;



const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'photoStorage')));


mongoose.set("strictQuery", false);
const userDB = mongoose.connect("mongodb://0.0.0.0:27017/userDB");


const gallerySchema = new mongoose.Schema ({
    url: String,
    sp: String,
    keywords: [String],
    category: String,
    orientation: String,
    size: [Number],
    likes: Number
})


const Gallery = new mongoose.model("Gallery",gallerySchema);

const profileSchema = new mongoose.Schema ({
    username: String,
    bio: String,
    profilePhoto: String,
    photoGallery: [gallerySchema]
})

const Profile = new mongoose.model("Profile", profileSchema);

const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    cart: [],
    profile: profileSchema,
})

const User = new mongoose.model("User", userSchema);


app.post("/signup", async (req,res) => {
    
    User.findOne({email: req.body.email}).then(async found => {
        if(!found) {
            console.log(req.body);
            const user1 = new User(req.body);
            await user1.save();
            res.send(req.body);            
        } else {
          res.send({})
        }
        
    })
    
});

app.post("/login", async (req,res) => {
    const mail = req.body.email;
    const pass = req.body.password;
    User.findOne({email:mail}).then(found => {
        if(found) {
            if(found.password===pass) {
                const token = jwt.sign({id: found._id},JWT_SECRET);            
                res.json({ token });
            } else {
                res.send({result: "Incorrect Password"});
            }
            
        } else {
            res.send({result: "User Not Found"})
        }
    })
})



app.get("/profile",auth, (req, res) => {
  const id = req.userId;
  User.findOne({ _id: id }).populate('profile.photoGallery').then(async (found) => {
    if (found) {
      if (found.profile) {
        const photoUrls = found.profile.photoGallery.map(
          (gallery) => gallery.url
        );
        const profileData = {
          username: found.profile.username,
          bio: found.profile.bio,
          profilePhoto: found.profile.profilePhoto,
          photoGallery: { photoUrl: photoUrls  },
        };

        res.send(profileData);
      } else {
        res.send({ username: "Username", bio: "bio", photoGallery: { photoUrl: [] } });
      }
    } else {
      res.status(404).send({ error: "User not found" });
    }
  });
});


app.post("/profile", auth, (req, res) => {
    const id = req.userId;
    User.findOne({ _id: id }).then(async (found) => {
      if (found) {
        if (found.profile) {
          found.profile.username = req.body.usernameText;
          found.profile.bio = req.body.bioText;
          await found.save();
        } else {
          const newProfile = new Profile({
            username: req.body.usernameText,
            bio: req.body.bioText,
          });
          await newProfile.save();
          found.profile = newProfile;
          await found.save();
        }
        res.send({ success: true });
      } else {
        res.status(404).send({ error: "User not found" });
      }
    });
  });
  



app.post("/profile/gallery", auth, async (req, res) => {
  const id = req.userId;
  const photoUrl = req.body.url;
  const sp = req.body.price;
  const words = req.body.keywords;
  const keywords = words.split(", ");
  const category = req.body.category;
  const width = req.body.width;
  const height = req.body.height;
  const orientation = width > height ? "horizontal" : "vertical";
  User.findOne({ _id: id }).then(async (found) => {
    if (found) {
      if (found.profile) {
        if (found.profile.photoGallery.length > 0) {
          found.profile.photoGallery.push({
            url: photoUrl,
            sp: sp,
            keywords: keywords,
            category: category,
            size: [height,width],
            orientation: orientation
          });
        } else {
          const gallery = new Gallery({
            url: photoUrl,
            sp: sp,
            keywords: keywords,
            category: category,
            size: [height,width],
            orientation: orientation
          });
          await gallery.save();
          found.profile.photoGallery = [gallery];
          await found.save();
        }
      } else {
        const gallery = new Gallery({
          url: photoUrl,
          sp: sp,
          keywords: keywords,
          category: category,
          size: [height,width],
          orientation: orientation
        });
        await gallery.save();
        const newProfile = new Profile({
          username: "",
          bio: "",
          photoGallery: [gallery]
        });
        await newProfile.save();
        found.profile = newProfile;
      }
      await found.save();
      res.send({ success: true });
    } else {
      res.status(404).send({ error: "User not found" });
    }
  }).catch((error) => {
    res.status(500).send({ error: "Internal server error" });
  });
});

app.post("/profile/profilePhoto", auth, (req, res) => {
  const id = req.userId;
  const photoUrl = req.body.profilePhoto;
  console.log(photoUrl);

  User.findOne({ _id: id }).then(async (found) => {
    if (found) {
      if (found.profile) {
        found.profile.profilePhoto = photoUrl;
        
      } else {
        const profile = new Profile({
          username: "Username",
          bio: "Bio",
          profilePhoto: photoUrl
        });
        await profile.save();
        
        found.profile = profile;
      }
      await found.save();
      res.send({ success: true });
    } else {
      res.status(404).send({ error: "User not found" });
    }
  }).catch((error) => {
    res.status(500).send({ error: "Internal server error" });
  });
});



app.delete("/profile/gallery",auth, (req, res) => {
  const userId = req.userId;
  const { photoUrl } = req.body;
  console.log(req.body);
  User.findOne({ _id: userId }).populate('profile.photoGallery').then(async (found) => {
    if (found) {
      if (found.profile && found.profile.photoGallery.length > 0) {
        const photoGallery = found.profile.photoGallery;
        const updatedPhotoGallery = photoGallery.filter(
          (gallery) => gallery.url !== photoUrl
        );
        found.profile.photoGallery = updatedPhotoGallery;
        await found.save();
        res.send({ success: true });
      } else {
        res.status(404).send({ error: "Photo gallery not found" });
      }
    } else {
      res.status(404).send({ error: "User not found" });
    }
  }).catch((error) => {
    res.status(500).send({ error: "Internal server error" });
  });
});


app.get("/", (req, res) => {
  User.find({}).populate('profile.photoGallery').then(async (users) => {
    const allPhotos = users.reduce((photos, user) => {
      if (user.profile && user.profile.photoGallery) {
        const userPhotos = user.profile.photoGallery.map((gallery) => ({
          username: user.profile.username,
          userId: user._id,
          photoUrl: gallery.url,
          photoId: gallery._id,
          sp: gallery.sp,
          keywords: gallery.keywords,
          category: gallery.category,
          size: gallery.size,
          orientation: gallery.orientation          
        })).filter((photo) => photo.photoUrl !== '');
        photos.push(...userPhotos);
      }
      return photos;
    }, []);

    res.send(allPhotos);
  }).catch((error) => {
    res.status(500).send({ error: "Internal server error" });
  });
});



app.get('/search', (req, res) => {
  const query = req.query.query;

  User.find({}).populate('profile.photoGallery').then(async (users) => {
    const searchResults = users.reduce((photos, user) => {
      if (user.profile && user.profile.photoGallery) {
        const userPhotos = user.profile.photoGallery
          .filter((gallery) => gallery.url !== '') // Exclude photos with empty URLs
          .filter((gallery) => {
            // Check if any keyword contains the search query substring
            return gallery.keywords.some((keyword) =>
              keyword.toLowerCase().includes(query.toLowerCase())
            );
          })
          .map((gallery) => ({
            username: user.profile.username,
            userId: user._id,
            photoUrl: gallery.url,
            photoId: gallery._id,
            sp: gallery.sp,
            keywords: gallery.keywords,
            category: gallery.category,
            size: gallery.size,
            orientation: gallery.orientation, 
          }));

        photos.push(...userPhotos);
      }
      return photos;
    }, []);

    res.send(searchResults);
  }).catch((error) => {
    res.status(500).send({ error: "Internal server error" });
  });
});




app.listen(5000,() => console.log("Localhost is running on port 5000."))

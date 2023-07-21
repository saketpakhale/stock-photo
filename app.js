
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
const mongopass = process.env.MONGODB_SECRET;
const userDB = mongoose.connect(`mongodb+srv://saketpakhale:${mongopass}@cluster0.i2pmeyw.mongodb.net/userDB`);



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


app.post("/signup", async (req, res) => {
  try {
    const found = await User.findOne({ email: req.body.email });

    if (!found) {
      const user1 = new User(req.body);
      await user1.save();
      res.send(req.body);
    } else {
      res.send({});
    }
  } catch (error) {
    res.status(500).send("An error occurred during signup.");
  }
});


app.post("/login", async (req, res) => {
  try {
    const mail = req.body.email;
    const pass = req.body.password;

    const found = await User.findOne({ email: mail });

    if (found) {
      if (found.password === pass) {
        const token = jwt.sign({ id: found._id }, JWT_SECRET);
        res.json({ token });
      } else {
        res.send({ result: "Incorrect Password" });
      }
    } else {
      res.send({ result: "User Not Found" });
    }
  } catch (error) {
    res.status(500).send("An error occurred during login.");
  }
});




app.get("/profile", auth, async (req, res) => {
  try {
    const id = req.userId;
    const found = await User.findOne({ _id: id }).populate('profile.photoGallery');

    if (found) {
      if (found.profile) {
        const photoUrls = found.profile.photoGallery.map(
          (gallery) => gallery.url
        );
        const profileData = {
          username: found.profile.username,
          bio: found.profile.bio,
          profilePhoto: found.profile.profilePhoto,
          photoGallery: { photoUrl: photoUrls },
        };

        res.send(profileData);
      } else {
        res.send({ username: "Username", bio: "bio", photoGallery: { photoUrl: [] } });
      }
    } else {
      res.status(404).send({ error: "User not found" });
    }
  } catch (error) {
    res.status(500).send("An error occurred while fetching the profile.");
  }
});



app.post("/profile", auth, async (req, res) => {
  try {
    const id = req.userId;
    const found = await User.findOne({ _id: id });

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
  } catch (error) {
    res.status(500).send("An error occurred while updating the profile.");
  }
});




app.post("/profile/gallery", auth, async (req, res) => {
  try {
    const id = req.userId;
    const photoUrl = req.body.url;
    const sp = req.body.price;
    const words = req.body.keywords;
    const keywords = words.split(", ");
    const category = req.body.category;
    const width = req.body.width;
    const height = req.body.height;
    const orientation = width > height ? "horizontal" : "vertical";

    const found = await User.findOne({ _id: id });

    if (found) {
      if (found.profile) {
        if (found.profile.photoGallery.length > 0) {
          found.profile.photoGallery.push({
            url: photoUrl,
            sp: sp,
            keywords: keywords,
            category: category,
            size: [height, width],
            orientation: orientation
          });
        } else {
          const gallery = new Gallery({
            url: photoUrl,
            sp: sp,
            keywords: keywords,
            category: category,
            size: [height, width],
            orientation: orientation
          });
          await gallery.save();
          found.profile.photoGallery = [gallery];
        }
      } else {
        const gallery = new Gallery({
          url: photoUrl,
          sp: sp,
          keywords: keywords,
          category: category,
          size: [height, width],
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
  } catch (error) {
    res.status(500).send({ error: "Internal server error" });
  }
});


app.post("/profile/profilePhoto", auth, async (req, res) => {
  try {
    const id = req.userId;
    const photoUrl = req.body.profilePhoto;

    const found = await User.findOne({ _id: id });

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
  } catch (error) {
    res.status(500).send({ error: "Internal server error" });
  }
});



app.delete("/profile/gallery", auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { photoUrl } = req.body;

    const found = await User.findOne({ _id: userId }).populate('profile.photoGallery');

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
  } catch (error) {
    res.status(500).send({ error: "Internal server error" });
  }
});



app.get("/", async (req, res) => {
  try {
    const users = await User.find({}).populate('profile.photoGallery');

    const allPhotos = users.reduce((photos, user) => {
      if (user.profile && user.profile.photoGallery) {
        const userPhotos = user.profile.photoGallery
          .map((gallery) => ({
            username: user.profile.username,
            userId: user._id,
            photoUrl: gallery.url,
            photoId: gallery._id,
            sp: gallery.sp,
            keywords: gallery.keywords,
            category: gallery.category,
            size: gallery.size,
            orientation: gallery.orientation          
          }))
          .filter((photo) => photo.photoUrl !== '');
        photos.push(...userPhotos);
      }
      return photos;
    }, []);

    res.send(allPhotos);
  } catch (error) {
    res.status(500).send({ error: "Internal server error" });
  }
});




app.get('/search', async (req, res) => {
  try {
    const query = req.query.query;

    const users = await User.find({}).populate('profile.photoGallery');

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
  } catch (error) {
    res.status(500).send({ error: "Internal server error" });
  }
});



const PORT = process.env.PORT || 5000;

app.listen(PORT,() => console.log("Localhost is running on port 5000."))

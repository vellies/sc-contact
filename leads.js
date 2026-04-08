const express = require('express');
const ApolloScraper = require('../models/apollo_scraper');
const ApolloEmailScraper = require('../models/apollo_scraper_email');
const ApolloEmailScraperOld = require('../models/apollo_scraper_email_old');
const router = express.Router();
const fs = require('fs');

const fileSave = async (file) => {
    let items = require(file);
    let users = []
    for (let i = 0; i < items.length; i++) {
        let item = items[i]
        // let checkEmail = await ApolloScraper.findOne({ email: item.email })
        item.userName = item.name
        item.firstName = item.first_name
        item.lastName = item.last_name
        item.phoneNumbers = item.phone_numbers
        item.email = item.email
        // item.id = item.id
        // item.emailStatus = item.email_status
        // item.linkedinUrl = item.linkedin_url
        item.title = item.title
        item.headline = item.headline
        item.state = item.state
        item.city = item.city
        item.country = item.country
        // item.type = item.type
        // item.userDetails = { ...item }
        // console.log('==============================================');
        // console.log('V10N',checkEmail?.email);
        // console.log('==============================================');
        // if (checkEmail?.email) {
        //     console.log('V10N', checkEmail?.email);
        users.push(item)
        // await new ApolloEmailScraper(item).save();
        // }
        // await new ApolloScraper(item).save();

    }
    // Extract email addresses from the new user data
    const emailList = users.map(user => user.email);

    try {
        // Step 1: Check the database for existing emails
        const existingUsers = await ApolloEmailScraper.find({ email: { $in: emailList } }).select('email');
        const existingEmails = existingUsers.map(user => user.email);

        // Step 2: Filter out users with emails already in the database
        const newUsers = users.filter(user => !existingEmails.includes(user.email));

        if (newUsers.length === 0) {
            console.log("All emails already exist in the database. No new users to insert.");
            return;
        }

        // Step 3: Perform bulk insert for new users only
        await ApolloEmailScraper.insertMany(newUsers, { ordered: false });
        console.log("Bulk insert successful for new users");

    } catch (error) {
        if (error.code === 11000) {
            // console.log("Duplicate email found during insertion:", error.message);
        } else {
            // console.error("Error during bulk insert:", error.message);
        }
    }

}
router.post('/apify/scrap_group_member_apollo_json', async (req, res) => {
    try {
        let { file_name } = req.body
        let file = file_name

        for (let j = 0; j < file.length; j++) {
            await fileSave(file[j])
            // console.log('==============================================');
            console.log('Success File:', file[j]);
            // console.log('==============================================');
        }

        let memberDataToSave = []

        res.status(200).json({ result: memberDataToSave, message: memberDataToSave.length + "apollo data Saved Successfully" })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/apify/update_phonenumber', async (req, res) => {
    try {
        // let { file_name } = req.body
        // let file = file_name
        // let leads = await ApolloEmailScraperOld.findOne({email:"ruiting.li@zerohash.com"})
        // console.log('==============================================');
        // console.log('V10N', leads.length);
        // console.log('==============================================');
        // let leads = await ApolloEmailScraper.updateMany(
        //     {}, // Match all documents
        //     [
        //         {
        //             $set: {
        //                 phoneNumbers: {
        //                     $ifNull: [
        //                         { $arrayElemAt: ["$userDetails.phone_numbers", 0] }, // Accessing nested fields
        //                         [] // Default to an empty array if null
        //                     ]
        //                 }
        //             }
        //         }
        //     ]
        // )

        let leads = await ApolloEmailScraper.updateMany(
            {}, // Match all documents
            [
                {
                    $set: {
                        phoneNumbers: {
                            // Check if userDetails.phone_numbers exists and is an array
                            $cond: {
                                if: {
                                    $and: [
                                        { $isArray: "$userDetails.phone_numbers" }, // Check if it's an array
                                        { $gt: [{ $size: "$userDetails.phone_numbers" }, 0] } // Check if it's not empty
                                    ]
                                },
                                then: "$userDetails.phone_numbers", // Set phoneNumbers to the existing array
                                else: [] // Otherwise, set to an empty array
                            }
                        }
                    }
                }
            ]
        );
        

        res.status(200).json({ result: leads })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/apify/get_file_names', async (req, res) => {
    try {
        let { path } = req.body
        console.log(path);
        let fileNameList = []
        // Read the contents of the directory
        await fs.readdir(path, async (err, files) => {
            if (err) {
                console.error('Error reading directory:', err);
                return;
            }

            // Log the list of file names
            console.log('Files in the directory:');
            await files.forEach(file => {
                console.log(file);
                fileNameList.push("." + path + '/' + file)
            });
            res.status(200).json({ file_name: fileNameList })
        });

    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.get('/apify/get_duplicate_emails', async (req, res) => {
    try {
        const duplicates = await ApolloEmailScraper.aggregate([
            {
                $group: {
                    _id: "$email",            // Group by email
                    count: { $sum: 1 }        // Count occurrences
                }
            },
            {
                $match: {
                    count: { $gt: 1 }         // Find emails that occur more than once
                }
            },
            {
                $project: {
                    _id: 0,                   // Exclude the default _id field
                    email: "$_id",            // Show the email field
                    count: 1                  // Show the count of duplicates
                }
            }
        ]);

        if (duplicates.length > 0) {
            res.status(200).json({ result: "Duplicate emails found:", duplicates })
        } else {
            res.status(200).json({ result: "No duplicate emails found." })
            console.log("No duplicate emails found.");
        }

    } catch (error) {
        res.status(200).json({ result: "Error checking duplicate emails:", error })
    }
})



module.exports = router;
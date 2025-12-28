const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME || 'caption_generator';
const CAPTIONS_COLLECTION = 'captions';
const FEEDBACK_COLLECTION = 'caption_feedback';

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not configured');
    process.exit(1);
}

async function migrateCaptionsToUserScoped() {
    let client;

    try {
        console.log('Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
        });

        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db(MONGODB_NAME);
        const captionColl = db.collection(CAPTIONS_COLLECTION);
        const feedbackColl = db.collection(FEEDBACK_COLLECTION);

        // Find all captions without userId field
        console.log('Finding captions to migrate...');
        const captionsToMigrate = await captionColl
            .find({
                userId: { $exists: false },
            })
            .toArray();

        console.log(`Found ${captionsToMigrate.length} captions without userId`);

        if (captionsToMigrate.length === 0) {
            console.log('No captions need migration. Exiting.');

            // Still create indexes if they don't exist
            console.log('Creating indexes...');
            await captionColl.createIndex({ userId: 1 });
            await captionColl.createIndex({ userId: 1, createdAt: -1 });
            await feedbackColl.createIndex({ userId: 1 });
            console.log('Indexes created successfully');

            return;
        }

        // Strategy: Delete orphaned captions (Option A - cleanest)
        // These captions were created before user-scoping was implemented
        // and cannot be associated with any user
        console.log('\n=== Migration Strategy ===');
        console.log('Orphaned captions (without userId) will be deleted.');
        console.log('This is the cleanest approach as they cannot be associated with any user.');
        console.log(`\n${captionsToMigrate.length} captions will be deleted.`);
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

        await new Promise((resolve) => setTimeout(resolve, 5000));

        let deletedCount = 0;
        let errorCount = 0;
        const errors = [];

        // Delete orphaned captions
        for (const caption of captionsToMigrate) {
            try {
                // Also delete associated feedback
                await feedbackColl.deleteMany({ captionId: caption._id });

                const deleteResult = await captionColl.deleteOne({ _id: caption._id });

                if (deleteResult.deletedCount === 1) {
                    deletedCount++;
                    if (deletedCount % 10 === 0) {
                        console.log(`Deleted ${deletedCount} captions...`);
                    }
                } else {
                    errorCount++;
                    errors.push({
                        captionId: caption._id.toString(),
                        error: 'Delete did not remove document',
                    });
                }
            } catch (error) {
                errorCount++;
                errors.push({
                    captionId: caption._id.toString(),
                    error: error.message,
                });
                console.error(`✗ Error deleting caption ${caption._id}:`, error.message);
            }
        }

        console.log('\n=== Migration Summary ===');
        console.log(`Total orphaned captions found: ${captionsToMigrate.length}`);
        console.log(`Successfully deleted: ${deletedCount}`);
        console.log(`Errors: ${errorCount}`);

        if (errors.length > 0) {
            console.log('\nErrors:');
            errors.slice(0, 10).forEach((err) => {
                console.log(`  - Caption ${err.captionId}: ${err.error}`);
            });
            if (errors.length > 10) {
                console.log(`  ... and ${errors.length - 10} more errors`);
            }
        }

        // Create indexes for performance
        console.log('\nCreating indexes...');
        try {
            await captionColl.createIndex({ userId: 1 });
            await captionColl.createIndex({ userId: 1, createdAt: -1 });
            await feedbackColl.createIndex({ userId: 1 });
            console.log('Indexes created successfully');
        } catch (indexError) {
            console.warn('Warning: Some indexes may already exist:', indexError.message);
        }

        console.log('\nMigration completed!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('MongoDB connection closed');
        }
    }
}

// Run migration
migrateCaptionsToUserScoped()
    .then(() => {
        console.log('Migration script finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });

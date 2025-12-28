const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME || 'caption_generator';
const COLLECTION_NAME = 'users';

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not configured');
    process.exit(1);
}

function splitName(name) {
    if (!name || typeof name !== 'string') {
        return { firstName: '', lastName: '' };
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
        return { firstName: '', lastName: '' };
    }

    // Split by last space
    const lastSpaceIndex = trimmed.lastIndexOf(' ');
    if (lastSpaceIndex === -1) {
        // Single word - treat as firstName
        return { firstName: trimmed, lastName: '' };
    }

    return {
        firstName: trimmed.substring(0, lastSpaceIndex).trim(),
        lastName: trimmed.substring(lastSpaceIndex + 1).trim(),
    };
}

function computeFullName(firstName, lastName) {
    const first = (firstName || '').trim();
    const last = (lastName || '').trim();
    if (first && last) {
        return `${first} ${last}`.trim();
    }
    return first || last || '';
}

async function migrateUserNames() {
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
        const collection = db.collection(COLLECTION_NAME);

        // Find all users that need migration (missing firstName, lastName, or fullName)
        console.log('Finding users to migrate...');
        const usersToMigrate = await collection
            .find({
                $or: [
                    { firstName: { $exists: false } },
                    { lastName: { $exists: false } },
                    { fullName: { $exists: false } },
                ],
            })
            .toArray();

        console.log(`Found ${usersToMigrate.length} users to migrate`);

        if (usersToMigrate.length === 0) {
            console.log('No users need migration. Exiting.');
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const user of usersToMigrate) {
            try {
                // Get firstName and lastName (may already exist or need to be split from name)
                let firstName = user.firstName;
                let lastName = user.lastName;

                // If firstName or lastName is missing, try to split from name field
                if (!firstName || !lastName) {
                    if (user.name) {
                        const split = splitName(user.name);
                        firstName = firstName || split.firstName || 'New';
                        lastName = lastName || split.lastName || '';
                    } else {
                        firstName = firstName || 'New';
                        lastName = lastName || '';
                    }
                }

                // Compute fullName
                const fullName = computeFullName(firstName, lastName) || user.name || '';

                const updateDoc = {};
                if (!user.firstName) updateDoc.firstName = firstName;
                if (!user.lastName) updateDoc.lastName = lastName;
                if (!user.fullName) updateDoc.fullName = fullName;
                // Keep name field for backward compatibility if it doesn't exist
                if (!user.name && fullName) updateDoc.name = fullName;

                const updateResult = await collection.updateOne(
                    { _id: user._id },
                    { $set: updateDoc }
                );

                if (updateResult.modifiedCount === 1) {
                    successCount++;
                    console.log(
                        `✓ Migrated user ${user._id}: firstName: "${firstName}", lastName: "${lastName}", fullName: "${fullName}"`
                    );
                } else {
                    errorCount++;
                    errors.push({
                        userId: user._id.toString(),
                        error: 'Update did not modify document',
                    });
                    console.log(`✗ Failed to migrate user ${user._id}`);
                }
            } catch (error) {
                errorCount++;
                errors.push({ userId: user._id.toString(), error: error.message });
                console.error(`✗ Error migrating user ${user._id}:`, error.message);
            }
        }

        console.log('\n=== Migration Summary ===');
        console.log(`Total users found: ${usersToMigrate.length}`);
        console.log(`Successfully migrated: ${successCount}`);
        console.log(`Errors: ${errorCount}`);

        if (errors.length > 0) {
            console.log('\nErrors:');
            errors.forEach((err) => {
                console.log(`  - User ${err.userId}: ${err.error}`);
            });
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
migrateUserNames()
    .then(() => {
        console.log('Migration script finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });

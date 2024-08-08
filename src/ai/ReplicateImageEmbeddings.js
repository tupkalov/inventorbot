import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default class ReplicateImageEmbeddings {
    async embedDocuments (fileUrls) {
        return await Promise.all(fileUrls.map(async (fileUrl) => {
            const output = await replicate.run("daanelson/imagebind:0383f62e173dc821ec52663ed22a076d9c970549c209666ac3db181618b7a304",
                { input: {
                    input: fileUrl,
                    modality: "vision"
                } });

            return output;
        }));
    }

    async embedQuery (fileUrl) {
        return (await this.embedDocuments([fileUrl]))[0];
    }
}
import { Client } from "@notionhq/client"
import { config } from "dotenv"

config()

const pageId = process.env.NOTION_PAGE_ID
const apiKey = process.env.NOTION_API_KEY
const blockIdentifyingContent = "reading time";

const notion = new Client({ auth: apiKey })

/* 
---------------------------------------------------------------------------
*/

/**
 * Resources:
 * - Appending block children endpoint (notion.blocks.children.append(): https://developers.notion.com/reference/patch-block-children)
 * - Working with page content guide: https://developers.notion.com/docs/working-with-page-content
 */

async function main() {
  const blockIds = [pageId] // Blocks can be appended to other blocks *or* pages. Therefore, a page ID can be used for the block_id parameter
  let readingTimeBlockId = "";

  console.log('Preparing to append block with ID:', pageId)

  try {
    let pageContent = "";

    while (blockIds.length) {
      const blockId = blockIds.pop();
      const blocks = await retrieveChildrenBlocks(blockId);
      
      pageContent += blocks.results.reduce((acc, block) => {
        if (block.has_children) { blockIds.push(block.id); } // recursively fetch blocks (API limitation)

        const isTopReadingTimeBlock = !readingTimeBlockId
          && block.paragraph?.rich_text.length
          && block.paragraph?.rich_text.some(t =>
            t.plain_text.length < 50 && t.plain_text.toLowerCase().includes(blockIdentifyingContent)
          )

        if (isTopReadingTimeBlock) { readingTimeBlockId = block.id; }

        acc += extractPageText(block) ?? "";
        return acc;
      }, '');
    }

    const wordCount = pageContent.split(" ").length - 1;

    const newHeadingResponse = readingTimeBlockId && await notion.blocks.update({
      block_id: readingTimeBlockId,
      paragraph: {
        rich_text: [
          {
            text: {
              content: `reading time: ${Math.round(wordCount / 200)} minutes | word count: ${wordCount}`, // This is the text that will be displayed in Notion
            },
            "annotations": {
              "italic": true
            }
          },
        ],
      },

    })
    console.log('Reading time successfully updated:', newHeadingResponse)
  } catch (error) {
    console.error('Error appending block:', error)
    throw error
  }

  async function retrieveChildrenBlocks(blockId) {
    return await notion.blocks.children.list({ block_id: blockId, page_size: 100 });
  }

  function extractPageText(block) {
    let results = "";

    function traverse(currentObj) {
      for (const key in currentObj) {
        if (currentObj.hasOwnProperty(key)) {
          // if (key === "content" && typeof currentObj[key] === "string") {
          if (key === "plain_text") {
            results += " " + currentObj[key];
          } else if (typeof currentObj[key] === "object" && currentObj[key] !== null) {
            traverse(currentObj[key]);
          }
        }
      }
    }

    traverse(block);
    return results;
  }
}

main()

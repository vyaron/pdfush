/**
 * PDF Document Classifier Service
 * Returns hard-coded classification results for splitting PDFs into separate documents
 */

// DOC Types
const DOC_TYPES = {
    ENGINE_DELIVERY_DOC: 'engineDeliveryDoc',
    OP_ON_OFF_LOG: 'opOnOffLog',
    PART_REMOVAL_TAG: 'partRemovalTag'
}

const pdfClassifierService = {
    /**
     * Analyzes a PDF and returns classification results
     * @param {File} file - The PDF file to classify
     * @returns {Promise<Array>} Array of document classifications
     * Each classification has:
     * - docTypes: Array of document types (first is primary)
     * - pages: Array of page numbers
     * - description: Description of the document content
     */
    async classifyDocument(file) {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        // Hard-coded classification results
        // 15 pages split into 5 documents of 3 pages each
        return [
            {
                docTypes: [DOC_TYPES.ENGINE_DELIVERY_DOC],
                pages: [1, 2, 3],
                description: "Engine delivery documentation"
            },
            {
                docTypes: [DOC_TYPES.OP_ON_OFF_LOG, DOC_TYPES.ENGINE_DELIVERY_DOC],
                pages: [4, 5, 6],
                description: "Operation on/off log with engine delivery details"
            },
            {
                docTypes: [DOC_TYPES.PART_REMOVAL_TAG],
                pages: [7, 8, 9],
                description: "Part removal tag documentation"
            },
            {
                docTypes: [DOC_TYPES.ENGINE_DELIVERY_DOC, DOC_TYPES.PART_REMOVAL_TAG],
                pages: [10, 11, 12],
                description: "Engine delivery documentation with part removal tag"
            },
            {
                docTypes: [DOC_TYPES.OP_ON_OFF_LOG],
                pages: [13, 14, 15],
                description: "Operation on/off log"
            }
        ]
    },

    /**
     * Gets the total number of pages from classification results
     * @param {Array} classifications - Array of document classifications
     * @returns {number} Total page count
     */
    getTotalPages(classifications) {
        return classifications.reduce((total, doc) => {
            return total + doc.pages.length
        }, 0)
    },

    /**
     * Gets the display name for a document based on its docTypes
     * @param {Array} docTypes - Array of document type strings
     * @returns {string} Display name with suffix if multiple types
     */
    getDocumentName(docTypes) {
        if (!docTypes || docTypes.length === 0) return 'Unknown'
        
        const primaryType = docTypes[0]
        
        if (docTypes.length === 1) {
            return primaryType
        }
        
        const additionalCount = docTypes.length - 1
        return `${primaryType}_and_${additionalCount}_more`
    }
}
// PDF.js worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js'

// DOM Elements
const dropArea = document.getElementById('drop-area')
const fileElem = document.getElementById('fileElem')
const classifyBtn = document.querySelector('.btn-classify')
const previewContainer = document.getElementById('preview-container')

// Global variables
let uploadedFile = null
let pdfDoc = null

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners()
})

function setupEventListeners() {
    // Safety check - ensure all elements exist
    if (!dropArea || !fileElem || !classifyBtn || !previewContainer) {
        console.error('Required DOM elements not found')
        return
    }

    // Drop area click to select file
    dropArea.addEventListener('click', () => {
        fileElem.click()
    })

    // File input change
    fileElem.addEventListener('change', (e) => {
        handleFiles(e.target.files)
    })

    // Drag and drop events
    const dragEvents = ['dragenter', 'dragover', 'dragleave', 'drop']
    dragEvents.forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false)
    })

    const highlightEvents = ['dragenter', 'dragover']
    highlightEvents.forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('highlight')
        }, false)
    })

    const unhighlightEvents = ['dragleave', 'drop']
    unhighlightEvents.forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('highlight')
        }, false)
    })

    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer
        const files = dt.files
        handleFiles(files)
    }, false)

    // Classify button
    classifyBtn.addEventListener('click', classifyPDF)
}

function preventDefaults(e) {
    e.preventDefault()
    e.stopPropagation()
}

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0]
        
        // Validate file type
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.')
            return
        }

        uploadedFile = file
        dropArea.querySelector('p').textContent = `Selected: ${file.name}`
        classifyBtn.disabled = false
    }
}

async function classifyPDF() {
    if (!uploadedFile) return

    // Disable button during processing
    classifyBtn.disabled = true
    
    // Show loading indicator
    showLoading()

    try {
        // Load the PDF
        const arrayBuffer = await uploadedFile.arrayBuffer()
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        // Get classification results from service (waits 5 seconds)
        const classifications = await pdfClassifierService.classifyDocument(uploadedFile)

        // Hide loading indicator
        hideLoading()

        // Display results
        displayClassificationResults(classifications)

    } catch (error) {
        console.error('Error classifying PDF:', error)
        hideLoading()
        alert('Error processing PDF. Please try again.')
        classifyBtn.disabled = false
    }
}

function showLoading() {
    previewContainer.innerHTML = `
        <div class="loading-container show">
            <div class="spinner"></div>
            <div class="loading-text">Analyzing PDF...</div>
        </div>
    `
}

function hideLoading() {
    const loadingContainer = previewContainer.querySelector('.loading-container')
    if (loadingContainer) {
        loadingContainer.classList.remove('show')
    }
}

function displayClassificationResults(classifications) {
    previewContainer.innerHTML = `
        <div class="success-message show">
            <strong>✓ Analysis Complete!</strong> Found ${classifications.length} documents.
        </div>
        <div class="documents-list"></div>
    `

    const documentsList = previewContainer.querySelector('.documents-list')

    classifications.forEach((doc, index) => {
        const docItem = createDocumentItem(doc, index)
        documentsList.appendChild(docItem)
    })
}

function createDocumentItem(doc, index) {
    const item = document.createElement('div')
    item.className = 'document-item'
    
    const pageRangeText = doc.pages.length === 1 
        ? `Page ${doc.pages[0]}` 
        : `Pages ${doc.pages[0]}-${doc.pages[doc.pages.length - 1]}`
    
    // Get document name using the service helper
    const documentName = pdfClassifierService.getDocumentName(doc.docTypes)
    
    // Create a display of all doc types
    const docTypesDisplay = doc.docTypes.length > 1 
        ? `<small style="color: #666; font-weight: normal;">(${doc.docTypes.join(', ')})</small>`
        : ''
    
    item.innerHTML = `
        <div class="document-header">
            <h3 class="document-title">${documentName} ${docTypesDisplay}</h3>
            <button class="btn-download" data-doc-index="${index}">Download</button>
        </div>
        <div class="document-info">
            <div class="document-pages">${pageRangeText} (${doc.pages.length} page${doc.pages.length > 1 ? 's' : ''})</div>
            <div class="document-description">${doc.description}</div>
        </div>
    `

    // Add download event listener
    const downloadBtn = item.querySelector('.btn-download')
    downloadBtn.addEventListener('click', () => downloadDocument(doc))

    return item
}

async function downloadDocument(doc) {
    try {
        // Load the original PDF with pdf-lib
        const arrayBuffer = await uploadedFile.arrayBuffer()
        const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer)
        
        // Create a new PDF document
        const newPdf = await PDFLib.PDFDocument.create()
        
        // Copy specified pages to the new document
        // Note: PDF pages are 0-indexed in pdf-lib, but our service uses 1-indexed
        const pageIndices = doc.pages.map(pageNum => pageNum - 1)
        const copiedPages = await newPdf.copyPages(pdfLibDoc, pageIndices)
        
        copiedPages.forEach((page) => {
            newPdf.addPage(page)
        })
        
        // Serialize the PDF to bytes
        const pdfBytes = await newPdf.save()
        
        // Create a blob and download
        const blob = new Blob([pdfBytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const filename = pdfClassifierService.getDocumentName(doc.docTypes)
        a.download = `${filename}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        console.log(`Downloaded: ${filename}.pdf`)
    } catch (error) {
        console.error('Error downloading document:', error)
        alert('Error creating PDF. Please try again.')
    }
}

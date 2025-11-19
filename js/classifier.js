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

async function displayClassificationResults(classifications) {
    previewContainer.innerHTML = `
        <div class="success-message show">
            <strong>✓ Analysis Complete!</strong> Found ${classifications.length} documents.
            <button class="btn-download-all" onclick="downloadAllDocuments()">⬇ Download All as ZIP</button>
        </div>
        <div class="documents-list"></div>
    `

    const documentsList = previewContainer.querySelector('.documents-list')
    
    // Add drop listeners to the documents list for section reordering
    addDocumentsListDropListeners(documentsList)

    for (let index = 0; index < classifications.length; index++) {
        const doc = classifications[index]
        const docItem = await createDocumentItem(doc, index)
        documentsList.appendChild(docItem)
    }
}

async function createDocumentItem(doc, index) {
    const item = document.createElement('div')
    item.className = 'document-item'
    item.dataset.docIndex = index
    
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
            <div class="title-container">
                <button class="collapse-button">▼</button>
                <h3 class="document-title">${documentName} ${docTypesDisplay}</h3>
                <span class="page-count">(${doc.pages.length} page${doc.pages.length > 1 ? 's' : ''})</span>
            </div>
            <button class="btn-download" data-doc-index="${index}">Download</button>
        </div>
        <div class="document-info">
            <div class="document-pages">${pageRangeText}</div>
            <div class="document-description">${doc.description}</div>
        </div>
        <div class="page-previews"></div>
    `

    // Render page previews
    const pagePreviews = item.querySelector('.page-previews')
    for (const pageNum of doc.pages) {
        const pageContainer = await renderPagePreview(pageNum, index)
        pagePreviews.appendChild(pageContainer)
    }

    // Add collapse functionality
    const collapseBtn = item.querySelector('.collapse-button')
    collapseBtn.addEventListener('click', () => toggleCollapse(item))

    // Add download event listener
    const downloadBtn = item.querySelector('.btn-download')
    downloadBtn.addEventListener('click', () => downloadDocumentByIndex(index))

    // Add drag-and-drop for entire section when collapsed
    addSectionDragListeners(item)

    // Add drop zone listeners to page previews
    addContainerDropListeners(pagePreviews)

    return item
}

async function renderPagePreview(pageNum, docIndex) {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 0.3 })
    
    const canvas = document.createElement('canvas')
    canvas.className = 'page-preview'
    canvas.dataset.pageNum = pageNum
    canvas.dataset.docIndex = docIndex
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    const context = canvas.getContext('2d')
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise
    
    const pageContainer = document.createElement('div')
    pageContainer.className = 'page-container'
    pageContainer.dataset.pageNum = pageNum
    pageContainer.dataset.docIndex = docIndex
    
    pageContainer.appendChild(canvas)
    
    // Add drag listeners to individual pages
    addPageDragListeners(pageContainer)
    
    return pageContainer
}

function toggleCollapse(docItem) {
    const pagePreviews = docItem.querySelector('.page-previews')
    const collapseBtn = docItem.querySelector('.collapse-button')
    
    if (pagePreviews.style.display === 'none') {
        pagePreviews.style.display = 'flex'
        collapseBtn.textContent = '▼'
        docItem.classList.remove('collapsed')
    } else {
        pagePreviews.style.display = 'none'
        collapseBtn.textContent = '▶'
        docItem.classList.add('collapsed')
    }
}

function addSectionDragListeners(docItem) {
    // Always enable dragging for collapsed sections
    const updateDraggable = () => {
        if (docItem.classList.contains('collapsed')) {
            docItem.setAttribute('draggable', 'true')
        } else {
            docItem.setAttribute('draggable', 'false')
        }
    }
    
    // Update on collapse state change
    const observer = new MutationObserver(updateDraggable)
    observer.observe(docItem, { attributes: true, attributeFilter: ['class'] })
    
    docItem.addEventListener('dragstart', (e) => {
        if (!docItem.classList.contains('collapsed')) {
            e.preventDefault()
            return
        }
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'section',
            docIndex: docItem.dataset.docIndex
        }))
        docItem.classList.add('dragging')
    })
    
    docItem.addEventListener('dragend', (e) => {
        docItem.classList.remove('dragging')
    })
}

function addPageDragListeners(pageContainer) {
    pageContainer.setAttribute('draggable', 'true')
    
    pageContainer.addEventListener('dragstart', (e) => {
        e.stopPropagation() // Prevent section drag from firing
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'page',
            pageNum: pageContainer.dataset.pageNum,
            docIndex: pageContainer.dataset.docIndex
        }))
        pageContainer.classList.add('dragging')
    })
    
    pageContainer.addEventListener('dragend', (e) => {
        pageContainer.classList.remove('dragging')
    })
}

function addDocumentsListDropListeners(documentsList) {
    documentsList.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.stopPropagation()
    })
    
    documentsList.addEventListener('dragenter', (e) => {
        e.preventDefault()
        e.stopPropagation()
    })
    
    documentsList.addEventListener('drop', (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        let data
        try {
            data = JSON.parse(e.dataTransfer.getData('text'))
        } catch (error) {
            console.error('Error parsing drag data:', error)
            return
        }
        
        // Only handle section drops here
        if (data.type !== 'section') return
        
        const draggableSection = document.querySelector(`.document-item[data-doc-index=\"${data.docIndex}\"]`)
        if (!draggableSection) return
        
        const targetDocItem = e.target.closest('.document-item')
        
        if (targetDocItem && targetDocItem !== draggableSection) {
            // Insert before the target
            const rect = targetDocItem.getBoundingClientRect()
            const midpoint = rect.top + rect.height / 2
            
            if (e.clientY < midpoint) {
                documentsList.insertBefore(draggableSection, targetDocItem)
            } else {
                documentsList.insertBefore(draggableSection, targetDocItem.nextSibling)
            }
        }
        
        document.querySelectorAll('.over').forEach(el => el.classList.remove('over'))
    })
}

function addContainerDropListeners(container) {
    container.addEventListener('dragover', dragOverPage)
    container.addEventListener('dragenter', dragEnterPage)
    container.addEventListener('dragleave', dragLeavePage)
    container.addEventListener('drop', dropPage)
}

function dragOverPage(e) {
    e.preventDefault()
    e.stopPropagation()
}

function dragEnterPage(e) {
    e.preventDefault()
    e.stopPropagation()
    const target = e.target.closest('.page-container')
    if (target) {
        target.classList.add('over')
    }
}

function dragLeavePage(e) {
    e.stopPropagation()
    const target = e.target.closest('.page-container')
    if (target && !target.contains(e.relatedTarget)) {
        target.classList.remove('over')
    }
}

function dropPage(e) {
    e.preventDefault()
    e.stopPropagation()
    
    let data
    try {
        data = JSON.parse(e.dataTransfer.getData('text'))
    } catch (error) {
        console.error('Error parsing drag data:', error)
        return
    }
    
    // Only handle page drops here
    if (data.type !== 'page') return
    
    const dropzone = e.currentTarget
    const draggableElement = document.querySelector(`.page-container[data-page-num=\"${data.pageNum}\"][data-doc-index=\"${data.docIndex}\"]`)
    const targetDocItem = dropzone.closest('.document-item')
    
    if (!draggableElement || !targetDocItem) {
        document.querySelectorAll('.over').forEach(el => el.classList.remove('over'))
        return
    }
    
    const targetContainer = e.target.closest('.page-container')
    
    if (targetContainer && targetContainer !== draggableElement) {
        // Insert before the target
        const rect = targetContainer.getBoundingClientRect()
        const midpoint = rect.left + rect.width / 2
        
        if (e.clientX < midpoint) {
            dropzone.insertBefore(draggableElement, targetContainer)
        } else {
            dropzone.insertBefore(draggableElement, targetContainer.nextSibling)
        }
    } else if (!targetContainer) {
        // Dropped in empty space, append to end
        dropzone.appendChild(draggableElement)
    }
    
    // Update the doc index for the moved page
    draggableElement.dataset.docIndex = targetDocItem.dataset.docIndex
    const canvas = draggableElement.querySelector('.page-preview')
    if (canvas) {
        canvas.dataset.docIndex = targetDocItem.dataset.docIndex
    }
    
    updateDocumentPageCounts()
    
    document.querySelectorAll('.over').forEach(el => el.classList.remove('over'))
}

function updateDocumentPageCounts() {
    const documentItems = previewContainer.querySelectorAll('.document-item')
    documentItems.forEach(item => {
        const pageCount = item.querySelectorAll('.page-container').length
        const pageCountElement = item.querySelector('.page-count')
        if (pageCountElement) {
            pageCountElement.textContent = `(${pageCount} page${pageCount !== 1 ? 's' : ''})`
        }
    })
}

async function downloadDocumentByIndex(docIndex) {
    try {
        // Find the document item
        const docItem = document.querySelector(`.document-item[data-doc-index="${docIndex}"]`)
        if (!docItem) {
            alert('Document not found.')
            return
        }
        
        // Get all page containers for this document
        const pageContainers = Array.from(docItem.querySelectorAll('.page-container'))
        
        if (pageContainers.length === 0) {
            alert('No pages in this document.')
            return
        }
        
        // Load the original PDF with pdf-lib
        const arrayBuffer = await uploadedFile.arrayBuffer()
        const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer)
        
        // Create a new PDF document
        const newPdf = await PDFLib.PDFDocument.create()
        
        // Get page numbers from current order (0-indexed for pdf-lib)
        const pageIndices = pageContainers.map(container => parseInt(container.dataset.pageNum) - 1)
        
        // Copy pages in current order
        const copiedPages = await newPdf.copyPages(pdfLibDoc, pageIndices)
        
        copiedPages.forEach((page) => {
            newPdf.addPage(page)
        })
        
        // Serialize the PDF to bytes
        const pdfBytes = await newPdf.save()
        
        // Get document name from title
        const titleElement = docItem.querySelector('.document-title')
        let filename = 'document'
        if (titleElement) {
            // Extract just the main name, not the small text
            const titleText = titleElement.childNodes[0].textContent.trim()
            filename = titleText || 'document'
        }
        
        // Create a blob and download
        const blob = new Blob([pdfBytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${filename}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        console.log(`Downloaded: ${filename}.pdf (${pageIndices.length} pages)`)
    } catch (error) {
        console.error('Error downloading document:', error)
        alert('Error creating PDF. Please try again.')
    }
}

async function downloadAllDocuments() {
    try {
        const documentItems = previewContainer.querySelectorAll('.document-item')
        
        if (documentItems.length === 0) {
            alert('No documents to download.')
            return
        }
        
        // Create a new JSZip instance
        const zip = new JSZip()
        
        // Load the original PDF once
        const arrayBuffer = await uploadedFile.arrayBuffer()
        const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer)
        
        // Process each document
        for (const docItem of documentItems) {
            const pageContainers = Array.from(docItem.querySelectorAll('.page-container'))
            
            if (pageContainers.length === 0) continue
            
            // Create a new PDF for this document
            const newPdf = await PDFLib.PDFDocument.create()
            
            // Get page numbers from current order
            const pageIndices = pageContainers.map(container => parseInt(container.dataset.pageNum) - 1)
            
            // Copy pages
            const copiedPages = await newPdf.copyPages(pdfLibDoc, pageIndices)
            copiedPages.forEach((page) => {
                newPdf.addPage(page)
            })
            
            // Get document name
            const titleElement = docItem.querySelector('.document-title')
            let filename = 'document'
            if (titleElement) {
                const titleText = titleElement.childNodes[0].textContent.trim()
                filename = titleText || 'document'
            }
            
            // Serialize PDF to bytes
            const pdfBytes = await newPdf.save()
            
            // Add to ZIP with unique filename
            zip.file(`${filename}.pdf`, pdfBytes)
        }
        
        // Generate the ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        
        // Download the ZIP
        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'classified_documents.zip'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        console.log(`Downloaded ZIP with ${documentItems.length} documents`)
    } catch (error) {
        console.error('Error downloading all documents:', error)
        alert('Error creating ZIP file. Please try again.')
    }
}

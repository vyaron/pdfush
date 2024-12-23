const { PDFDocument, rgb, degrees } = PDFLib

// Set up the worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js'

let pdfDataStore = {}
let pageOrder = []


document.addEventListener('DOMContentLoaded', () => {
    const headerImg = document.querySelector('header img')
    if (headerImg) {
        headerImg.classList.add('header-img-animate')

        // Remove the animation class after it completes
        headerImg.addEventListener('animationend', () => {
            headerImg.classList.remove('header-img-animate')
        })
    }
})

const dropArea = document.getElementById('drop-area')
const fileElem = document.getElementById('fileElem')
const previewContainer = document.getElementById('preview-container')

// Prevent default drag behaviors
;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false)
    document.body.addEventListener(eventName, preventDefaults, false)
})

// Highlight drop area when item is dragged over it
;['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false)
})

;['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false)
})

// Handle dropped files
dropArea.addEventListener('drop', handleDrop, false)

// Handle clicked files
dropArea.addEventListener('click', () => fileElem.click())
fileElem.addEventListener('change', handleFiles)

function preventDefaults(e) {
    e.preventDefault()
    e.stopPropagation()
}

function highlight() {
    dropArea.classList.add('highlight')
}

function unhighlight() {
    dropArea.classList.remove('highlight')
}

function handleDrop(e) {
    const dt = e.dataTransfer
    const files = dt.files
    handleFiles(files)
}

function handleFiles(files) {
    document.querySelector('#combineButton').disabled = false

    if (files instanceof FileList) {
        ([...files]).forEach(previewFile)
    } else if (files.target && files.target.files) {
        ([...files.target.files]).forEach(previewFile)
    }
}

function previewFile(file) {
    const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    
    if (file.type === 'application/pdf') {
        handlePdfFile(file)
    } else if (supportedImageTypes.includes(file.type)) {
        handleImageFile(file)
    } else {
        console.error('Unsupported file type:', file.type)
        return
    }
}

function handlePdfFile(file) {
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)

    reader.onload = function(e) {
        const pdfData = new Uint8Array(e.target.result)
        pdfDataStore[file.name] = pdfData

        pdfjsLib.getDocument(pdfData).promise.then(function(pdf) {
            const pdfPreview = document.createElement('div')
            pdfPreview.className = 'pdf-preview'

            const pdfHeader = document.createElement('div')
            pdfHeader.className = 'pdf-header'

            // Create title container
            const titleContainer = document.createElement('div')
            titleContainer.className = 'title-container'

            // Create editable title div
            const pdfTitle = document.createElement('div')
            pdfTitle.className = 'pdf-title'
            pdfTitle.contentEditable = true
            pdfTitle.dataset.originalName = file.name
            pdfTitle.textContent = file.name

            // Create separate page count span
            const pageCount = document.createElement('span')
            pageCount.className = 'page-count'
            updatePageCount(pageCount, pdf.numPages)

            // Add blur event for title editing
            pdfTitle.addEventListener('blur', () => {
                const newName = pdfTitle.textContent.trim()
                if (newName && newName !== file.name) {
                    const oldName = file.name
                    updatePdfName(oldName, newName, pdfPreview)
                }
            })

            // Add key events for better editing experience
            pdfTitle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    pdfTitle.blur()
                }
                if (e.key === 'Escape') {
                    e.preventDefault()
                    pdfTitle.textContent = pdfTitle.dataset.originalName
                    pdfTitle.blur()
                }
            })

            titleContainer.appendChild(pdfTitle)
            titleContainer.appendChild(pageCount)

            const collapseButton = document.createElement('button')
            collapseButton.className = 'collapse-button'
            collapseButton.textContent = '▼'
            collapseButton.onclick = () => toggleCollapse(pdfPreview)

            pdfHeader.appendChild(titleContainer)
            pdfHeader.appendChild(collapseButton)
            pdfPreview.appendChild(pdfHeader)

            const pagePreviews = document.createElement('div')
            pagePreviews.className = 'page-previews'
            pdfPreview.appendChild(pagePreviews)

            previewContainer.appendChild(pdfPreview)

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                pdf.getPage(pageNum).then(function(page) {
                    const scale = 0.2
                    const viewport = page.getViewport({ scale: scale })

                    const canvas = document.createElement('canvas')
                    const context = canvas.getContext('2d')
                    canvas.height = viewport.height
                    canvas.width = viewport.width
                    canvas.classList.add('page-preview')
                    canvas.setAttribute('draggable', 'true')
                    canvas.dataset.pageNum = pageNum
                    canvas.dataset.pdfName = file.name

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    }

                    page.render(renderContext)

                    const pageContainer = document.createElement('div')
                    pageContainer.className = 'page-container'
                    pageContainer.appendChild(canvas)

                    // Create delete button
                    const deleteButton = document.createElement('button')
                    deleteButton.className = 'mini-button delete-button'
                    deleteButton.innerHTML = '🗑️'
                    deleteButton.title = 'Delete page'
                    deleteButton.onclick = (e) => {
                        e.stopPropagation()
                        deletePage(pageContainer, file.name, pageNum)
                    }

                    // Create full view button
                    const fullViewButton = document.createElement('button')
                    fullViewButton.className = 'mini-button full-view-button'
                    fullViewButton.innerHTML = '🔍'
                    fullViewButton.title = 'View full page'
                    fullViewButton.onclick = (e) => {
                        e.stopPropagation()
                        showFullPage(file.name, pageNum)
                    }

                    // Create rotate button
                    const rotateButton = document.createElement('button')
                    rotateButton.className = 'mini-button rotate-button'
                    rotateButton.innerHTML = '🔄'
                    rotateButton.title = 'Rotate page'
                    rotateButton.onclick = (e) => {
                        e.stopPropagation()
                        rotatePage(pageContainer, file.name, pageNum)
                    }

                    pageContainer.appendChild(deleteButton)
                    pageContainer.appendChild(fullViewButton)
                    pageContainer.appendChild(rotateButton)

                    pagePreviews.appendChild(pageContainer)

                    // Add page to pageOrder
                    pageOrder.push({ pdfName: file.name, pageNum: pageNum })

                    // Add drag and drop event listeners
                    addDragDropListeners(pageContainer)
                })
            }

            addContainerDropListeners(pagePreviews)
        })
    }
}

async function handleImageFile(file) {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    try {
        const imageData = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
        })

        // Create a PDF from the image
        const pdfDoc = await PDFDocument.create()
        
        // Load the image based on its type
        let image
        if (file.type === 'image/jpeg') {
            image = await pdfDoc.embedJpg(imageData)
        } else if (file.type === 'image/png') {
            image = await pdfDoc.embedPng(imageData)
        } else {
            // For other formats, convert to PNG first
            const pngData = await convertImageToPng(imageData)
            image = await pdfDoc.embedPng(pngData)
        }

        // Use standard A4 page size (595.28 x 841.89 points)
        const page = pdfDoc.addPage([595.28, 841.89])
        const { width, height } = image
        
        // Calculate scaling to fit the image within the page while maintaining aspect ratio
        const pageWidth = page.getWidth()
        const pageHeight = page.getHeight()
        
        let scaledWidth = pageWidth - 40 // 20pt margin on each side
        let scaledHeight = (height * scaledWidth) / width
        
        // If height exceeds page height, scale based on height instead
        if (scaledHeight > pageHeight - 40) {
            scaledHeight = pageHeight - 40 // 20pt margin on top and bottom
            scaledWidth = (width * scaledHeight) / height
        }
        
        // Center the image on the page
        const x = (pageWidth - scaledWidth) / 2
        const y = (pageHeight - scaledHeight) / 2

        // Draw the image
        page.drawImage(image, {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight
        })

        // Convert to PDF bytes and create a virtual PDF file
        const pdfBytes = await pdfDoc.save()
        const pdfName = `${file.name}.pdf`
        const pdfFile = new File([pdfBytes], pdfName, { type: 'application/pdf' })
        
        // Use existing PDF preview function
        previewFile(pdfFile)
        
    } catch (error) {
        console.error('Error processing image:', error)
    }
}

// Helper function for converting other image formats to PNG
function convertImageToPng(imageData) {
    return new Promise((resolve) => {
        const tempImage = new Image()
        tempImage.src = imageData
        tempImage.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = tempImage.width
            canvas.height = tempImage.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(tempImage, 0, 0)
            resolve(canvas.toDataURL('image/png'))
        }
    })
}

// Update the combinePDFs function
async function combinePDFs() {
    if (pageOrder.length === 0) {
        alert('No PDFs to combine')
        return
    }

    const mergedPdf = await PDFDocument.create()

    for (const pageContainer of document.querySelectorAll('.page-container')) {
        const pagePreview = pageContainer.querySelector('.page-preview')
        // Use original source information if available, otherwise use current
        const sourcePdfName = pageContainer.dataset.originalPdfName || pagePreview.dataset.pdfName
        const sourcePageNum = parseInt(pageContainer.dataset.originalPageNum || pagePreview.dataset.pageNum)
        const rotation = parseInt(pagePreview.dataset.rotation || '0')
        
        const pdfData = pdfDataStore[sourcePdfName]
        
        if (!pdfData) {
            console.error(`Original PDF data not found for ${sourcePdfName}`)
            continue
        }

        try {
            const sourceDoc = await PDFDocument.load(pdfData)
            const [copiedPage] = await mergedPdf.copyPages(sourceDoc, [sourcePageNum - 1])
            
            if (rotation) {
                copiedPage.setRotation(degrees(rotation))
            }
            
            mergedPdf.addPage(copiedPage)
        } catch (error) {
            console.error(`Error processing page ${sourcePageNum} from ${sourcePdfName}:`, error)
        }
    }

    const pdfBytes = await mergedPdf.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'combined.pdf'
    link.click()
}

// Add event listener for the combine button
document.getElementById('combineButton').addEventListener('click', combinePDFs)

function deletePage(pageContainer, pdfName, pageNum) {
    const pdfPreview = pageContainer.closest('.pdf-preview')
    
    // Remove the page from the DOM
    pageContainer.remove()

    // Remove the page from pageOrder
    const index = pageOrder.findIndex(p => p.pdfName === pdfName && p.pageNum === parseInt(pageNum))
    if (index > -1) {
        pageOrder.splice(index, 1)
    }

    // Update page count in title
    updatePdfPageCounts(pdfPreview)

    // If this was the last page of the PDF, remove the entire PDF preview
    if (pdfPreview.querySelectorAll('.page-container').length === 0) {
        pdfPreview.remove()
        delete pdfDataStore[pdfName]
        console.log(`Removed entire PDF: ${pdfName}`)
    }

    console.log('Updated page order:', pageOrder)
}

async function showFullPage(pdfName, pageNum) {
    const pdfData = pdfDataStore[pdfName]
    if (!pdfData) {
        console.error(`PDF data not found for ${pdfName}`)
        return
    }

    try {
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise
        
        // Get actual available pages from the current DOM structure
        const pdfPreview = Array.from(document.querySelectorAll('.pdf-preview'))
            .find(preview => preview.querySelector('.pdf-title').textContent.includes(pdfName))
        const availablePages = Array.from(pdfPreview.querySelectorAll('.page-preview'))
            .map(preview => parseInt(preview.dataset.pageNum))
            .sort((a, b) => a - b)

        if (!availablePages.includes(parseInt(pageNum))) {
            console.error('Page no longer exists')
            return
        }

        let currentPageIndex = availablePages.indexOf(parseInt(pageNum))
        let currentPage = availablePages[currentPageIndex]

        const renderPage = async (pageNumber) => {
            const page = await pdf.getPage(pageNumber)
            const scale = 2
            const viewport = page.getViewport({ scale: scale })

            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d')
            canvas.height = viewport.height
            canvas.width = viewport.width

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            }

            await page.render(renderContext).promise
            return canvas
        }

        const modal = document.createElement('div')
        modal.className = 'modal'

        const modalContent = document.createElement('div')
        modalContent.className = 'modal-content'

        const closeBtn = document.createElement('span')
        closeBtn.className = 'close'
        closeBtn.innerHTML = '&times'
        closeBtn.onclick = () => modal.style.display = 'none'

        // Add navigation buttons container
        const navContainer = document.createElement('div')
        navContainer.className = 'nav-buttons'
        
        const prevBtn = document.createElement('button')
        prevBtn.textContent = '← Previous'
        prevBtn.disabled = currentPageIndex === 0
        
        const pageInfo = document.createElement('span')
        pageInfo.className = 'page-info'
        pageInfo.textContent = `Page ${currentPage} of ${pdf.numPages} (${availablePages.length} remaining)`
        
        const nextBtn = document.createElement('button')
        nextBtn.textContent = 'Next →'
        nextBtn.disabled = currentPageIndex === availablePages.length - 1

        navContainer.appendChild(prevBtn)
        navContainer.appendChild(pageInfo)
        navContainer.appendChild(nextBtn)

        const imgContainer = document.createElement('div')
        imgContainer.className = 'img-container'
        
        const updatePreview = async (newPageIndex) => {
            currentPageIndex = newPageIndex;
            currentPage = availablePages[currentPageIndex];
            const canvas = await renderPage(currentPage);
            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.style.width = '100%';
            
            // Clear and update image container
            imgContainer.innerHTML = '';
            imgContainer.appendChild(img);
            
            // Update navigation state
            prevBtn.disabled = currentPageIndex === 0;
            nextBtn.disabled = currentPageIndex === availablePages.length - 1;
            pageInfo.textContent = `Page ${currentPage} of ${pdf.numPages} (${availablePages.length} remaining)`;
            
            // Update field buttons to work with current page
            updateFieldButtons(pdfName, currentPage, img);
        }

        prevBtn.onclick = () => {
            if (currentPageIndex > 0) {
                updatePreview(currentPageIndex - 1);
            }
        }

        nextBtn.onclick = () => {
            if (currentPageIndex < availablePages.length - 1) {
                updatePreview(currentPageIndex + 1);
            }
        }

        const buttonContainer = document.createElement('div')
        buttonContainer.className = 'field-buttons'

        const updateFieldButtons = (pdfName, pageNum, img) => {
            buttonContainer.innerHTML = ''
            const dateBtn = createFieldButton('Date', () => addField(pdfName, pageNum, 'date', img))
            const nameBtn = createFieldButton('Name', () => addField(pdfName, pageNum, 'name', img))
            const signatureBtn = createFieldButton('Signature', () => addField(pdfName, pageNum, 'signature', img))
            
            buttonContainer.appendChild(dateBtn)
            buttonContainer.appendChild(nameBtn)
            buttonContainer.appendChild(signatureBtn)
        }

        modalContent.appendChild(closeBtn)
        modalContent.appendChild(navContainer)
        modalContent.appendChild(imgContainer)
        modalContent.appendChild(buttonContainer)
        modal.appendChild(modalContent)

        document.body.appendChild(modal)
        modal.style.display = 'block'
        
        // Initial render
        await updatePreview(currentPageIndex);

    } catch (error) {
        console.error('Error rendering full page:', error)
    }
}

function createFieldButton(text, onClick) {
    const button = document.createElement('button')
    button.textContent = text
    button.onclick = () => {
        onClick()
        button.disabled = true
        setTimeout(() => { button.disabled = false }, 500)
    }
    return button
}

function toggleCollapse(pdfPreview) {
    const pagePreviews = pdfPreview.querySelector('.page-previews')
    const collapseButton = pdfPreview.querySelector('.collapse-button')

    if (pagePreviews.style.display === 'none') {
        pagePreviews.style.display = 'flex'
        collapseButton.textContent = '▼'
    } else {
        pagePreviews.style.display = 'none'
        collapseButton.textContent = '▶'
    }
}

async function addFormFieldsToPage(pdfDoc, pageIndex) {
    const page = pdfDoc.getPages()[pageIndex]
    const { width, height } = page.getSize()

    // Add a name field
    const nameField = pdfDoc.getForm().createTextField('name')
    nameField.setText('')
    nameField.addToPage(page, {
        x: 50,
        y: height - 100,
        width: 200,
        height: 20,
    })

    // Add a date field
    const dateField = pdfDoc.getForm().createTextField('date')
    dateField.setText('')
    dateField.addToPage(page, {
        x: 300,
        y: height - 100,
        width: 100,
        height: 20,
    })

    // Add a signature field (as a text field)
    const signatureField = pdfDoc.getForm().createTextField('signature')
    signatureField.setText('')
    signatureField.addToPage(page, {
        x: 50,
        y: height - 200,
        width: 200,
        height: 50,
    })
}

async function addFormFields(pdfName, pageIndex) {
    const pdfData = pdfDataStore[pdfName]
    if (!pdfData) {
        console.error(`PDF data not found for ${pdfName}`)
        return
    }

    try {
        const pdfDoc = await PDFDocument.load(pdfData)
        await addFormFieldsToPage(pdfDoc, pageIndex)

        const modifiedPdfBytes = await pdfDoc.save()
        pdfDataStore[pdfName] = modifiedPdfBytes

        // Re-render the preview
        const pdfPreviews = document.querySelectorAll('.pdf-preview')
        const pdfPreview = Array.from(pdfPreviews).find(preview =>
            preview.querySelector('.pdf-title').textContent.includes(pdfName)
        )

        if (pdfPreview) {
            pdfPreview.remove()
            previewFile(new File([modifiedPdfBytes], pdfName, { type: 'application/pdf' }))
        }

        console.log(`Form fields added to page ${pageIndex + 1} of ${pdfName}`)
    } catch (error) {
        console.error('Error adding form fields:', error)
    }
}

function addField(pdfName, pageNum, fieldType, img) {
    const addFieldHandler = (e) => {
        const rect = img.getBoundingClientRect()
        const x = (e.clientX - rect.left) / img.width
        const y = 1 - (e.clientY - rect.top) / img.height // Invert Y coordinate

        // Create a visual indicator for the field
        const indicator = createFieldIndicator(fieldType, e.clientX - rect.left, e.clientY - rect.top)
        img.parentNode.appendChild(indicator)

        // Add the field to the PDF
        addFormFieldToPDF(pdfName, pageNum - 1, fieldType, x, y, indicator)

        img.removeEventListener('click', addFieldHandler)
    }

    img.addEventListener('click', addFieldHandler)
}

function createFieldIndicator(fieldType, x, y) {
    const indicator = document.createElement('div')
    indicator.className = 'field-indicator'
    indicator.textContent = fieldType.charAt(0).toUpperCase() + fieldType.slice(1)
    indicator.style.left = `${x}px`
    indicator.style.top = `${y}px`

    const removeButton = document.createElement('span')
    removeButton.className = 'remove-field'
    removeButton.textContent = '×'
    removeButton.onclick = (e) => {
        e.stopPropagation()
        indicator.remove()
        // Here you would also remove the field from the PDF
    }

    indicator.appendChild(removeButton)
    return indicator
}

async function addFormFieldToPDF(pdfName, pageIndex, fieldType, x, y, indicator) {
    const pdfData = pdfDataStore[pdfName]
    if (!pdfData) {
        console.error(`PDF data not found for ${pdfName}`)
        return
    }

    try {
        const pdfDoc = await PDFDocument.load(pdfData)
        const page = pdfDoc.getPages()[pageIndex]
        const { width, height } = page.getSize()

        const fieldName = `${fieldType}_${Date.now()}`
        const field = pdfDoc.getForm().createTextField(fieldName)
        field.setText('')
        field.addToPage(page, {
            x: x * width,
            y: y * height,
            width: fieldType === 'date' ? 100 : 200,
            height: fieldType === 'signature' ? 50 : 20,
        })

        const modifiedPdfBytes = await pdfDoc.save()
        pdfDataStore[pdfName] = modifiedPdfBytes

        // Store the field information for later removal if needed
        indicator.dataset.fieldName = fieldName
        indicator.dataset.pdfName = pdfName
        indicator.dataset.pageIndex = pageIndex

        console.log(`${fieldType} field added to page ${pageIndex + 1} of ${pdfName}`)
    } catch (error) {
        console.error('Error adding form field:', error)
    }
}

async function removeFormField(indicator) {
    const { fieldName, pdfName, pageIndex } = indicator.dataset
    const pdfData = pdfDataStore[pdfName]
    if (!pdfData) {
        console.error(`PDF data not found for ${pdfName}`)
        return
    }

    try {
        const pdfDoc = await PDFDocument.load(pdfData)
        const form = pdfDoc.getForm()
        form.removeField(fieldName)

        const modifiedPdfBytes = await pdfDoc.save()
        pdfDataStore[pdfName] = modifiedPdfBytes

        indicator.remove()

        console.log(`Field ${fieldName} removed from page ${parseInt(pageIndex) + 1} of ${pdfName}`)
    } catch (error) {
        console.error('Error removing form field:', error)
    }
}

function updatePageOrder() {
    // Clear the existing page order
    pageOrder = []
    
    // Rebuild the page order by iterating through all PDF previews
    document.querySelectorAll('.pdf-preview').forEach(pdfPreview => {
        const pdfName = pdfPreview.querySelector('.pdf-title').textContent.split(' (')[0]
        
        pdfPreview.querySelectorAll('.page-container').forEach(pageContainer => {
            const pagePreview = pageContainer.querySelector('.page-preview')
            const rotation = parseInt(pagePreview.dataset.rotation || '0')
            const pageNum = parseInt(pagePreview.dataset.pageNum)
            
            pageOrder.push({
                pdfName: pdfName,
                pageNum: pageNum,
                rotation: rotation
            })
        })
    })
    
    console.log('Updated page order:', JSON.stringify(pageOrder, null, 2))
}

function rotatePage(pageContainer, pdfName, pageNum) {
    const canvas = pageContainer.querySelector('.page-preview')
    let currentRotation = parseInt(canvas.dataset.rotation || '0')
    currentRotation = (currentRotation + 90) % 360
    canvas.dataset.rotation = currentRotation

    canvas.style.transform = `rotate(${currentRotation}deg)`

    // Update the rotation in the pageOrder array
    const pageIndex = pageOrder.findIndex(p => p.pdfName === pdfName && p.pageNum === parseInt(pageNum))
    if (pageIndex > -1) {
        pageOrder[pageIndex].rotation = currentRotation
    }

    console.log(`Rotated page ${pageNum} of ${pdfName} to ${currentRotation} degrees`)

    // Update the PDF in pdfDataStore
    updatePDFRotation(pdfName, pageNum, currentRotation)
}

async function updatePDFRotation(pdfName, pageNum, rotation) {
    const pdfData = pdfDataStore[pdfName]
    if (!pdfData) {
        console.error(`PDF data not found for ${pdfName}`)
        return
    }

    try {
        const pdfDoc = await PDFDocument.load(pdfData)
        const pages = pdfDoc.getPages()
        const page = pages[pageNum - 1]

        page.setRotation(degrees(rotation))

        const modifiedPdfBytes = await pdfDoc.save()
        pdfDataStore[pdfName] = modifiedPdfBytes

        console.log(`Updated rotation for page ${pageNum} of ${pdfName} in pdfDataStore`)
    } catch (error) {
        console.error('Error updating PDF rotation:', error)
    }
}

function addDragDropListeners(element) {
    element.setAttribute('draggable', 'true')
    element.addEventListener('dragstart', dragStart)
    element.addEventListener('dragend', dragEnd)
}

function addContainerDropListeners(container) {
    container.addEventListener('dragover', dragOver)
    container.addEventListener('dragenter', dragEnter)
    container.addEventListener('dragleave', dragLeave)
    container.addEventListener('drop', drop)
}

function dragStart(e) {
    const pageContainer = e.target.closest('.page-container')
    e.dataTransfer.setData('text/plain', JSON.stringify({
        pageNum: pageContainer.querySelector('.page-preview').dataset.pageNum,
        pdfName: pageContainer.querySelector('.page-preview').dataset.pdfName
    }))
    pageContainer.classList.add('dragging')
}

function dragEnd(e) {
    e.target.classList.remove('dragging')
}

function dragOver(e) {
    e.preventDefault()
}

function dragEnter(e) {
    e.preventDefault()
    if (e.target.classList.contains('page-preview')) {
        e.target.classList.add('over')
    }
}

function dragLeave(e) {
    e.target.classList.remove('over')
}

function drop(e) {
    e.preventDefault()
    let data
    try {
        data = JSON.parse(e.dataTransfer.getData('text'))
    } catch (error) {
        console.error('Error parsing drag data:', error)
        return
    }
    
    const pageNum = parseInt(data.pageNum)
    const sourcePdfName = data.pdfName

    const draggableElement = document.querySelector(`.page-container .page-preview[data-page-num="${pageNum}"][data-pdf-name="${sourcePdfName}"]`).closest('.page-container')
    const dropzone = e.target.closest('.page-previews')

    if (dropzone && draggableElement) {
        const targetPdfPreview = dropzone.closest('.pdf-preview')
        const sourcePdfPreview = draggableElement.closest('.pdf-preview')
        const targetPdfName = targetPdfPreview.querySelector('.pdf-title').textContent.split(' (')[0]
        
        if (e.target.closest('.page-container')) {
            dropzone.insertBefore(draggableElement, e.target.closest('.page-container'))
        } else {
            dropzone.appendChild(draggableElement)
        }

        // Store original source information
        if (!draggableElement.dataset.originalPdfName) {
            draggableElement.dataset.originalPdfName = sourcePdfName
            draggableElement.dataset.originalPageNum = pageNum
        }

        // Update the current PDF name in the preview's dataset
        const pagePreview = draggableElement.querySelector('.page-preview')
        pagePreview.dataset.pdfName = targetPdfName
        
        // Update page counts in titles
        updatePdfPageCounts(sourcePdfPreview)
        if (sourcePdfPreview !== targetPdfPreview) {
            updatePdfPageCounts(targetPdfPreview)
        }
        
        updatePageOrder()
    }

    document.querySelectorAll('.over').forEach(el => el.classList.remove('over'))
}

function updatePdfPageCounts(pdfPreview) {
    if (!pdfPreview) return
    
    const pageCount = pdfPreview.querySelector('.page-count')
    const count = pdfPreview.querySelectorAll('.page-container').length
    updatePageCount(pageCount, count)
}

function updatePageCount(pageCountElement, count) {
    pageCountElement.textContent = `(${count} pages)`
}

function updatePdfName(oldName, newName, pdfPreview) {
    // Update pdfDataStore
    pdfDataStore[newName] = pdfDataStore[oldName]
    delete pdfDataStore[oldName]

    // Update all page previews in this PDF
    const pagePreviews = pdfPreview.querySelectorAll('.page-preview')
    pagePreviews.forEach(preview => {
        preview.dataset.pdfName = newName
    })

    // Update pageOrder array
    pageOrder.forEach(page => {
        if (page.pdfName === oldName) {
            page.pdfName = newName
        }
    })

    console.log(`Renamed PDF from "${oldName}" to "${newName}"`)
}


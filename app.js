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
    if (file.type !== 'application/pdf') {
        console.error('Not a PDF file!')
        return
    }

    const reader = new FileReader()
    reader.readAsArrayBuffer(file)

    reader.onload = function (e) {
        const pdfData = new Uint8Array(e.target.result)
        pdfDataStore[file.name] = pdfData

        pdfjsLib.getDocument(pdfData).promise.then(function (pdf) {
            const pdfPreview = document.createElement('div')
            pdfPreview.className = 'pdf-preview'

            const pdfHeader = document.createElement('div')
            pdfHeader.className = 'pdf-header'

            const pdfTitle = document.createElement('div')
            pdfTitle.className = 'pdf-title'
            pdfTitle.textContent = `${file.name} (${pdf.numPages} pages)`

            const collapseButton = document.createElement('button')
            collapseButton.className = 'collapse-button'
            collapseButton.textContent = '▼'
            collapseButton.onclick = () => toggleCollapse(pdfPreview)

            pdfHeader.appendChild(pdfTitle)
            pdfHeader.appendChild(collapseButton)
            pdfPreview.appendChild(pdfHeader)

            const pagePreviews = document.createElement('div')
            pagePreviews.className = 'page-previews'
            pdfPreview.appendChild(pagePreviews)

            previewContainer.appendChild(pdfPreview)

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                pdf.getPage(pageNum).then(function (page) {
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

                    // Note: There should be no add-form-field button here

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
        const targetPdfName = dropzone.closest('.pdf-preview').querySelector('.pdf-title').textContent.split(' (')[0]
        
        if (e.target.closest('.page-container')) {
            dropzone.insertBefore(draggableElement, e.target.closest('.page-container'))
        } else {
            dropzone.appendChild(draggableElement)
        }

        // Store original page information
        draggableElement.dataset.originalPdfName = sourcePdfName
        draggableElement.dataset.originalPageNum = pageNum

        // Update the page preview's dataset
        const pagePreview = draggableElement.querySelector('.page-preview')
        pagePreview.dataset.pdfName = targetPdfName
        
        updatePageOrder()
    }

    document.querySelectorAll('.over').forEach(el => el.classList.remove('over'))
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
        const originalPdfName = pageContainer.dataset.originalPdfName || pagePreview.dataset.pdfName
        const originalPageNum = parseInt(pageContainer.dataset.originalPageNum || pagePreview.dataset.pageNum)
        const rotation = parseInt(pagePreview.dataset.rotation || '0')
        
        const pdfData = pdfDataStore[originalPdfName]
        
        if (!pdfData) {
            console.error(`Original PDF data not found for ${originalPdfName}`)
            continue
        }

        try {
            const sourceDoc = await PDFDocument.load(pdfData)
            const [copiedPage] = await mergedPdf.copyPages(sourceDoc, [originalPageNum - 1])
            
            if (rotation) {
                copiedPage.setRotation(degrees(rotation))
            }
            
            mergedPdf.addPage(copiedPage)
        } catch (error) {
            console.error(`Error processing page ${originalPageNum} from ${originalPdfName}:`, error)
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
    // Remove the page from the DOM
    pageContainer.remove()

    // Remove the page from pageOrder
    const index = pageOrder.findIndex(p => p.pdfName === pdfName && p.pageNum === parseInt(pageNum))
    if (index > -1) {
        pageOrder.splice(index, 1)
    }

    // Remove the page from pdfDataStore
    if (pdfDataStore[pdfName]) {
        // Note: This doesn't actually modify the PDF, just our local representation
        console.log(`Removed page ${pageNum} from ${pdfName} in local storage`)
    }

    console.log('Updated page order:', pageOrder)

    // If this was the last page of the PDF, remove the entire PDF preview
    const pdfPreview = pageContainer.closest('.pdf-preview')
    if (pdfPreview && pdfPreview.querySelectorAll('.page-container').length === 0) {
        pdfPreview.remove()
        delete pdfDataStore[pdfName]
        console.log(`Removed entire PDF: ${pdfName}`)
    }
}

async function showFullPage(pdfName, pageNum) {
    const pdfData = pdfDataStore[pdfName]
    if (!pdfData) {
        console.error(`PDF data not found for ${pdfName}`)
        return
    }

    try {
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise
        const page = await pdf.getPage(parseInt(pageNum))
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

        const modal = document.createElement('div')
        modal.className = 'modal'

        const modalContent = document.createElement('div')
        modalContent.className = 'modal-content'

        const closeBtn = document.createElement('span')
        closeBtn.className = 'close'
        closeBtn.innerHTML = '&times'
        closeBtn.onclick = () => modal.style.display = 'none'

        const img = document.createElement('img')
        img.src = canvas.toDataURL('image/png')
        img.style.width = '100%'

        const buttonContainer = document.createElement('div')
        buttonContainer.className = 'field-buttons'

        const dateBtn = createFieldButton('Date', () => addField(pdfName, pageNum, 'date', img))
        const nameBtn = createFieldButton('Name', () => addField(pdfName, pageNum, 'name', img))
        const signatureBtn = createFieldButton('Signature', () => addField(pdfName, pageNum, 'signature', img))

        buttonContainer.appendChild(dateBtn)
        buttonContainer.appendChild(nameBtn)
        buttonContainer.appendChild(signatureBtn)

        modalContent.appendChild(closeBtn)
        modalContent.appendChild(img)
        modalContent.appendChild(buttonContainer)
        modal.appendChild(modalContent)

        document.body.appendChild(modal)
        modal.style.display = 'block'
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


let bookMetadata = [];
let booksInMemory = new Map();
let currentModalBook = null;
let currentlyViewingBook = null;
let currentBlobUrl = null;

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput = document.getElementById('fileInput');
const booksGrid = document.getElementById('booksGrid');
const uploadModal = document.getElementById('uploadModal');
const modalBookName = document.getElementById('modalBookName');
const modalFileInput = document.getElementById('modalFileInput');
const pdfViewerSection = document.getElementById('pdfViewerSection');
const librarySection = document.getElementById('librarySection');
const pdfViewer = document.getElementById('pdfViewer');
const currentBookTitle = document.getElementById('currentBookTitle');
const pageInfo = document.getElementById('pageInfo');
let pdfDoc = null;
let currentPage = 1;
const pdfCanvas = document.getElementById('pdfCanvas');
const pdfCtx = pdfCanvas.getContext('2d');

window.addEventListener('load', loadBookMetadata);
fileInput.addEventListener('change', handleFileSelect);

function handleFileSelect(e) {
    const files = e.target.files;
    processFiles(files);
}

async function processFiles(files) {
    for (let file of files) {
        if (file.type === 'application/pdf') {
            await addBook(file);
        }
    }
    renderBooks();
}

async function addBook(file) {
    try {
        const bookId = Date.now() + Math.random();
        
        const bookMeta = {
            id: bookId,
            name: file.name,
            currentPage: 1,
            totalPages: 0,
            dateAdded: new Date().toLocaleDateString(),
            fileSize: file.size,
            lastModified: file.lastModified
        };

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const safeCopy = new Uint8Array(uint8Array); 
        booksInMemory.set(bookId, safeCopy);
        
        try {
            const testCopy = new Uint8Array(safeCopy);
            const pdfDoc = await pdfjsLib.getDocument(testCopy).promise;
            bookMeta.totalPages = pdfDoc.numPages;
        } catch (error) {
            console.error('Error reading PDF pages:', error);
            bookMeta.totalPages = 1;
        }

        bookMetadata.push(bookMeta);
        saveBookMetadata();
        
    } catch (error) {
        console.error('Error adding book:', error);
        alert('Error adding PDF. Please try again.');
    }
}

function loadBookMetadata() {
    try {
        const stored = localStorage.getItem('bookMetadata');
        if (stored) {
            bookMetadata = JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading metadata:', error);
        bookMetadata = [];
    }
    renderBooks();
}

function saveBookMetadata() {
    try {
        localStorage.setItem('bookMetadata', JSON.stringify(bookMetadata));
    } catch (error) {
        console.error('Error saving metadata:', error);
        alert('Error saving book metadata to localStorage');
    }
}

function renderBooks() {
    if (bookMetadata.length === 0) {
        booksGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📖</div>
                <h3>No books yet</h3>
                <p>Upload your first PDF to get started!</p>
            </div>
        `;
        return;
    }

    booksGrid.innerHTML = bookMetadata.map(book => {
        const progress = book.totalPages > 0 ? (book.currentPage / book.totalPages) * 100 : 0;
        const isInMemory = booksInMemory.has(book.id);
        const statusClass = isInMemory ? 'status-ready' : 'status-needs-upload';
        const statusText = isInMemory ? 'Ready to read' : 'Needs re-upload';
        const cardClass = isInMemory ? '' : 'needs-upload';

        return `
            <div class="book-card ${cardClass}">
                <div class="book-title">${escapeHtml(book.name)}</div>
                <div class="book-status ${statusClass}">${statusText}</div>
                <div class="book-info">
                    Added: ${book.dateAdded}<br>
                    Page ${book.currentPage} of ${book.totalPages || '?'}
                </div>
                <div class="book-progress">
                    <div class="book-progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="book-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-primary ${!isInMemory ? 'hidden' : ''}" onclick="readBook('${book.id}')">
                      Read
                    </button>
                    <button class="btn btn-secondary" onclick="promptReupload('${book.id}')">Re-upload</button>
                    <button class="btn btn-danger" onclick="deleteBook('${book.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function renderPage(pageNum) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });

    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;

    await page.render({
        canvasContext: pdfCtx,
        viewport: viewport
    }).promise;

    currentlyViewingBook.currentPage = pageNum;
    saveBookMetadata();
    updatePageInfo();
}

async function readBook(bookId) {
    const book = bookMetadata.find(b => b.id == bookId);
    if (!book) {
        alert('Book not found!');
        return;
    }

    if (!booksInMemory.has(book.id)) {
        promptReupload(bookId);
        return;
    }

    try {
        const pdfData = booksInMemory.get(book.id);
        console.log("book id:", book.id);
        console.log("pdf Data type:", pdfData.constructor.name);
        console.log("pdf Data length:", pdfData.length);
        console.log("pdf Data buffer detached:", pdfData.buffer.byteLength === 0);

        if (pdfData.length === 0) {
            console.error('PDF data is empty or detached');
            alert('PDF data is corrupted. Please re-upload the file.');
            promptReupload(bookId);
            return;
        }

        const freshData = new Uint8Array(pdfData.length);
        freshData.set(pdfData);
        
        console.log("fresh Data length:", freshData.length);
        
        const loadingTask = pdfjsLib.getDocument({ data: freshData });
        pdfDoc = await loadingTask.promise;

        currentlyViewingBook = book;
        currentPage = book.currentPage;

        librarySection.style.display = 'none';
        pdfViewerSection.style.display = 'block';
        currentBookTitle.textContent = book.name;

        updatePageInfo();
        renderPage(currentPage);
        window.scrollTo(0, 0);

    } catch (error) {
        console.error('Error opening PDF:', error);
        alert('Error opening PDF. Please try re-uploading the file.');
    }
}

function closePdfViewer() {
    pdfViewerSection.style.display = 'none';
    librarySection.style.display = 'block';
    currentlyViewingBook = null;
    pdfDoc = null;
    currentPage = 1;
    pdfCanvas.getContext('2d').clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
    renderBooks();
}

function nextPage() {
    if (!pdfDoc || !currentlyViewingBook) return;
    if (currentPage < pdfDoc.numPages) {
        currentPage++;
        renderPage(currentPage);
    }
}

function previousPage() {
    if (!pdfDoc || !currentlyViewingBook) return;
    if (currentPage > 1) {
        currentPage--;
        renderPage(currentPage);
    }
}

function updatePageInfo() {
    if (!currentlyViewingBook) return;
    pageInfo.textContent = `Page ${currentlyViewingBook.currentPage} of ${currentlyViewingBook.totalPages}`;
}

function updateBookPage(bookId, page) {
    const book = bookMetadata.find(b => b.id == bookId);
    if (book) {
        book.currentPage = page;
        saveBookMetadata();
        renderBooks();
        if (currentlyViewingBook && currentlyViewingBook.id == bookId) {
            updatePageInfo();
        }
    }
}

function promptReupload(bookId) {
    const book = bookMetadata.find(b => b.id == bookId);
    if (!book) {
        alert('Book not found for re-upload!');
        return;
    }

    currentModalBook = book;
    modalBookName.textContent = book.name;
    uploadModal.style.display = 'block';
}

async function handleModalUpload() {
    const file = modalFileInput.files[0];

    if (!file) {
        alert('Please select a file first.');
        return;
    }

    if (!currentModalBook) {
        alert('Internal error: No book selected for re-upload.');
        console.error('currentModalBook is null');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        console.log('Reuploaded arrayBuffer size:', arrayBuffer.byteLength);

        if (arrayBuffer.byteLength === 0) {
            alert('This file appears to be empty.');
            return;
        }

        const fileMatches = validateFileMatch(file, currentModalBook);
        if (!fileMatches.isValid) {
            if (!confirm(`Warning: This file doesn't match the original book!\n\n${fileMatches.message}\n\nDo you want to continue anyway? This will replace the book with a different file.`)) {
                return;
            }
        }

        const uint8Array = new Uint8Array(arrayBuffer);
        const safeCopy = new Uint8Array(uint8Array); 
        booksInMemory.set(currentModalBook.id, safeCopy);

        console.log('Stored book id:', currentModalBook.id);
        console.log('booksInMemory.get().length:', booksInMemory.get(currentModalBook.id)?.length);

        try {
            const testCopy = new Uint8Array(safeCopy);
            const pdfDoc = await pdfjsLib.getDocument(testCopy).promise;
            
            currentModalBook.totalPages = pdfDoc.numPages;
            currentModalBook.fileSize = file.size;
            currentModalBook.lastModified = file.lastModified;
            currentModalBook.name = file.name; 
            
            saveBookMetadata();
        } catch (error) {
            console.error('Error reading PDF pages:', error);
            alert('Error reading PDF. Please make sure the file is a valid PDF.');
            return;
        }

        const reopenedBookId = currentModalBook.id;
        closeModal();
        renderBooks();

        if (reopenedBookId) {
            setTimeout(() => readBook(reopenedBookId), 100);
        }
    } catch (error) {
        console.error('Error handling modal upload:', error);
        alert('Error processing file. Please try again.');
    }
}

function closeModal() {
    uploadModal.style.display = 'none';
    modalFileInput.value = '';
    currentModalBook = null;
}

function deleteBook(bookId) {
    if (confirm('Are you sure you want to delete this book?')) {
        bookMetadata = bookMetadata.filter(book => book.id != bookId);
        booksInMemory.delete(bookId);
        saveBookMetadata();
        renderBooks();
    }
}

function validateFileMatch(file, originalBook) {
    const issues = [];
    
    if (file.name !== originalBook.name) {
        issues.push(`• File name: "${file.name}" vs original "${originalBook.name}"`);
    }
    
    const isValid = issues.length === 0;
    const message = issues.length > 0 
        ? `Differences detected:\n${issues.join('\n')}`
        : 'File appears to match the original.';
    
    return {
        isValid,
        message,
        issues
    };
}

window.onclick = function(event) {
    if (event.target === uploadModal) {
        closeModal();
    }
}
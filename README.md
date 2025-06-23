# Bookmark

I need to keep track of the books I'm reading, but since I'm limited to a static app, this is what I came up with. The major downside is that the books need to be re-uploaded after every refresh, as they are only stored in memory. The only data saved in localStorage is the book's metadata and the current page, which helps ensure the correct file is selected for resuming reading. 

* as of my previous knowledge, there was no way to access the user's local file system in web apps. But I came across the MDN docs about the File System Access API — might rework if seems promising.

document.addEventListener('DOMContentLoaded', () => {
    // Hiệu ứng Fade-in trồi lên khi load trang
    const toolCards = document.querySelectorAll('.tool-item');
    
    // Đặt trạng thái ban đầu là ẩn và thụt xuống
    toolCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    });

    // Kích hoạt animation lệch thời gian (Stagger effect)
    setTimeout(() => {
        toolCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 150); // Mỗi card xuất hiện cách nhau 0.15s
        });
    }, 100);
});